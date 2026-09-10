# 18. メディアアップロード基盤

## 目的

写真・動画を R2 に安全に保存・配信するための共通基盤を整備する。各記録への添付 UI（`19`〜`23`）はすべてこの基盤を利用する。

## スコープ

- R2（`MEDIA_BUCKET`）へのアップロード処理（Route Handler）
  - 対応形式：画像は JPEG／PNG／WebP／GIF、動画は MP4／WebM／QuickTime（MOV）
  - MIME タイプは `Content-Type` ヘッダーではなく先頭バイト（マジックナンバー）で判定する
- 画像の EXIF 削除
  - 元データは再エンコードせず、JPEG の APP1／APP2 セグメント、PNG の `eXIf`・`tEXt`・`iTXt`・`zTXt` チャンク、WebP の `EXIF`・`XMP ` チャンクをバイト列レベルで除去する（画質劣化を避けるため）
  - 動画のメタデータ除去は本 PR では行わない（後述の制約）
- サムネイル生成
  - 画像：ブラウザ側で長辺 1024px に縮小したサムネイル候補を元データと同時に送り、Workers 上で WASM の画像処理ライブラリ（`@cf-wasm/photon`）により長辺 512px の WebP にする。Workers は元画像をデコードしない（photon は画像全体を RGBA に展開するため、高解像度写真をそのまま処理すると Workers のメモリ上限 128 MB を超える）。候補がない場合は 4 MP 以下の画像に限って Workers 側で生成する
  - 動画：ブラウザ側で `<video>` + `<canvas>` により先頭フレームを切り出し、元データと同時にサムネイルとして送信する。Workers 側では動画のデコードを行わない
- 配信用 Route Handler
  - `GET /media/[assetId]` で元データ、`GET /media/[assetId]/thumbnail` でサムネイルを R2 から取得し、ストリーミングで返す
  - `Cache-Control: private, max-age=...` を付与し、共有キャッシュには載せない（Cloudflare Access の保護対象のため）
  - アクセス確認は Cloudflare Access（ダッシュボードで設定済み。エッジで遮断される）に委ね、本 PR では検証ロジックを持たない。`15` のアプリ側 JWT 検証は多層防御の保険であり、本 PR の前提ではない
- 上限の設定
  - 1 ファイルあたりの上限：画像 10 MB、動画 100 MB（暫定値。環境変数 `MEDIA_MAX_IMAGE_BYTES`・`MEDIA_MAX_VIDEO_BYTES` で上書き可能にする）
  - 保存容量の上限：合計 10 GB（暫定値。R2 の無料枠を基準にする。環境変数 `MEDIA_STORAGE_LIMIT_BYTES` で上書き可能にする）
  - 容量の集計は `media_assets.size_bytes` の `SUM` で行い、上限超過時はアップロードを拒否する
- 削除処理の共通関数
  - `deleteMediaAssetsByRecord(recordType, recordId)`：指定レコードに紐付く `media_assets` 行と R2 オブジェクト（元データ・サムネイル）をまとめて削除する。各記録の削除アクションは `19` 以降でこの関数を呼ぶ
  - `deleteMediaAsset(assetId)`：1 件削除
- `media_assets` 行の作成・取得を行う `src/features/media/` のクエリ・アクション
- 開発確認用のアップロードフォーム（`src/app/dev/media/`。`04` の `dev/components` と同様、本番では露出させない）

## 対象外

- 各記録の画面への添付 UI・一覧でのサムネイル表示（`19`〜`23`）
- 動画のメタデータ（位置情報等）の除去。Workers 上で動画コンテナを書き換える現実的な手段がないため、添付 UI 側で「動画は位置情報を含む場合がある」旨を表示するに留める
- 署名付き URL（presigned URL）によるブラウザからの直接アップロード。S3 互換 API のキー管理が増えるため採用せず、Workers 経由でアップロードする
- Cloudflare Images（有料の変換サービス）の利用
- AI 補助分類（第3段階、`17`）

## 依存 PR

- `03`（DB スキーマ基盤・`media_assets` テーブル）
- `15`（Cloudflare Access）は前提としない。Access のポリシーはダッシュボードで設定済みのため、配信エンドポイントはアプリ側の実装なしでエッジで保護される。`15` が先に完了していれば、そのミドルウェアがそのまま配信エンドポイントにも適用される

## 変更・追加内容

- `src/app/api/media/route.ts`（`POST`：アップロード）
- `src/app/media/[assetId]/route.ts`、`src/app/media/[assetId]/thumbnail/route.ts`（`GET`：配信）
- `src/features/media/`
  - `exif.ts`（EXIF 除去。形式ごとに純 TypeScript で実装し、単体テストを付ける）
  - `thumbnail.ts`（画像サムネイル生成）
  - `mimeSniff.ts`（マジックナンバーによる形式判定）
  - `limits.ts`（上限値の読み込み）
  - `queries.ts`、`actions.ts`（`media_assets` の CRUD、削除共通関数）
  - `objectKey.ts`（R2 のオブジェクトキー命名：`{recordType}/{recordId}/{assetId}` と `.../{assetId}.thumb.webp`）
- `src/db/schema/media-assets.ts` へのカラム追加
- `.env.example` への上限値の追記
- `docs/deploy.md` への R2 バケットの運用（本番バケットの作成・容量監視）の追記
- `src/db/README.md` の `media_assets` の節を「書き込み実装済み」に更新

## DB マイグレーション

- `media_assets` テーブルにカラムを追加
  - `size_bytes`（`integer`、NOT NULL、既定値 0）：元データのサイズ。容量集計に使う
  - `thumbnail_size_bytes`（`integer`、nullable）
  - `width`・`height`（`integer`、nullable）：画像・動画サムネイルの表示レイアウト用
  - `sort_order`（`integer`、NOT NULL、既定値 0）：同一レコード内での表示順
- `media_assets(record_type, record_id)` にインデックスを追加

## 受け入れ条件

- 対応形式の画像・動画をアップロードすると R2 に元データとサムネイルが保存され、`media_assets` 行が作成される
- アップロードした JPEG／PNG／WebP から EXIF・XMP が除去されていることを単体テスト（サンプルバイナリ）で確認する
- 非対応形式・上限超過のファイルは拒否され、エラーメッセージが返る
- 配信エンドポイントから元データ・サムネイルを取得できる。本番相当の環境では Access 経由でのみ取得できることを確認する
- `deleteMediaAssetsByRecord` を呼ぶと `media_assets` 行と R2 オブジェクトの両方が削除される
- 主要なロジック（EXIF 除去、形式判定、上限判定、オブジェクトキー生成）に Vitest の単体テストがある
