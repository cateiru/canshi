# デプロイ

CANSHI の Cloudflare 環境へのデプロイ手順・運用設定をまとめる。`docs/plans/` の実装計画には含めず、本ファイルに集約する。

## 前提

- ホスティング：Cloudflare Workers
- ビルド：`@opennextjs/cloudflare` で `next build` の出力を Workers 向けに変換する
- DB：Cloudflare D1
- オブジェクトストレージ：Cloudflare R2（写真・動画の本体は非公開バケットに保存）
- バックグラウンド処理：Cloudflare Workflows（定期通知のスケジュール実行）
- 認証・外部アクセス制御：Cloudflare Access（アプリ内のユーザー管理・認可は実装しない）

## 必要な Cloudflare リソース

- Workers（アプリ本体）
- D1 データベース（本番・ステージング用に分離するかは要検討）
- R2 バケット
  - メディア（写真・動画）用バケット（非公開）
  - ISR・SSG のキャッシュ用バケット（メディア用とは分離する。`docs/idea/index.md` の方針）
- Cloudflare Access のアプリケーション設定（対象ドメイン、許可ポリシー）
- Cloudflare Workflows（定期通知が実装される第2段階以降で必要）

## 環境変数・シークレット

`docs/plans/01_project_setup.md` で用意する `.env.example` を基準に、本番用の値を Cloudflare のシークレット管理（`wrangler secret put` 等）で設定する。

- D1・R2 のバインディング名（`wrangler.toml` で定義）
- Cloudflare Access の Team ドメイン・Audience タグ（`docs/plans/15_cloudflare_access.md` 参照）
- OpenAI API キー（第3段階の AI 機能実装時に追加）

## デプロイ手順（TODO）

未着手の検討事項。着手前に内容を確定させる。

- Cloudflare アカウント・ゾーンの準備
- `wrangler.toml` の本番向け設定（D1・R2 バインディング、ルート設定）
- CI（GitHub Actions）からの `wrangler deploy` 自動化の要否・方法
- ステージング環境を用意するかどうか
- マイグレーション（`wrangler d1 migrations apply`）の本番適用フロー

## R2 バケット（メディア）

写真・動画の本体とサムネイルは `wrangler.toml` の `[[r2_buckets]]`（バインディング名 `MEDIA_BUCKET`、バケット名 `canshi-media`）に保存する。ローカル開発では Miniflare が `.wrangler/state` 配下にエミュレートするため、バケットの作成は不要。

### 本番バケットの作成

```sh
wrangler r2 bucket create canshi-media
```

- バケットは非公開のまま運用する（パブリックアクセス・カスタムドメインは設定しない）。配信はアプリの `GET /media/[assetId]` 経由で行い、Cloudflare Access で保護する
- オブジェクトキーは `{recordType}/{recordId}/{assetId}`（元データ）と `{recordType}/{recordId}/{assetId}.thumb.webp`（サムネイル）

### 上限値

1 ファイルあたりの上限と合計の保存容量は環境変数で上書きできる（既定値は画像 10 MB／動画 100 MB／合計 10 GB）。`wrangler.toml` の `[vars]` またはダッシュボードで設定する。

```toml
[vars]
MEDIA_MAX_IMAGE_BYTES = "10485760"
MEDIA_MAX_VIDEO_BYTES = "104857600"
MEDIA_STORAGE_LIMIT_BYTES = "10737418240"
```

- 合計容量は `media_assets.size_bytes` と `thumbnail_size_bytes` の合計で判定する。R2 の実使用量とは独立した値のため、R2 側のオブジェクトを直接操作した場合はずれる
- Workers のメモリ上限（128 MB）の都合上、動画の上限を 100 MB より大きくすることは推奨しない。アップロード時にリクエスト本体をメモリに展開するため、大きすぎる値はメモリ不足で失敗する
- サムネイル生成（WASM）は CPU 時間を消費する。Workers Free プランの CPU 時間上限（10 ms／リクエスト）では大きな画像の処理が失敗するため、Paid プランを前提とする

### 容量の監視

- ダッシュボードの R2 ページでバケットの使用量を確認する。R2 の無料枠（10 GB／月）を超えないよう、`MEDIA_STORAGE_LIMIT_BYTES` は無料枠以下に保つ
- 記録・猫の削除時にアプリが R2 のオブジェクトも削除するが、R2 の削除だけ失敗した場合は `media_assets` 行が残る（再度削除すれば片付く）。行の削除後に R2 側だけ残る孤立オブジェクトは発生しない設計だが、念のため定期的に `wrangler r2 object list` 等で確認する

## Cloudflare Access 設定

対象ドメイン・アプリケーションの登録と許可ユーザーのポリシーは Cloudflare ダッシュボードで設定済み（2026-09 時点）。以下は未整理。

- 許可するユーザー（メールアドレス等）の追加・削除の運用方法
- `docs/plans/15_cloudflare_access.md` で実装する JWT 検証に必要な Team ドメイン・Audience タグの控え

## 監視・運用（TODO）

- エラー監視・ログの方針
- D1・R2 の利用量・コストの監視
- バックアップ方針（D1・R2）

## 備考

本ファイルは実装の進行に合わせて更新する。各 TODO は該当する実装 PR（`docs/plans/`）に着手する前に内容を確定させること。
