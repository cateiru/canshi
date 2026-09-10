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
- Cloudflare Access の Team ドメイン・Audience タグ（下記「Cloudflare Access 設定」参照）
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
- サムネイル生成（WASM）は CPU 時間を消費する。Workers Free プランの CPU 時間上限（10 ms／リクエスト）では処理が失敗しうるため、Paid プランを前提とする
- Workers はメモリ上限（128 MB）の都合上、元画像をデコードしない。ブラウザが長辺 1024px に縮小したサムネイル候補だけをデコードし、候補がない場合は 4 MP（`MAX_DECODE_PIXELS`）以下の画像に限って Workers 側でサムネイルを生成する。それより大きい画像は「画像が大きすぎるためサムネイルを作成できませんでした」として拒否する

### 容量の監視

- ダッシュボードの R2 ページでバケットの使用量を確認する。R2 の無料枠（10 GB／月）を超えないよう、`MEDIA_STORAGE_LIMIT_BYTES` は無料枠以下に保つ
- 記録・猫の削除時にアプリが R2 のオブジェクトも削除するが、R2 の削除だけ失敗した場合は `media_assets` 行が残る（再度削除すれば片付く）。行の削除後に R2 側だけ残る孤立オブジェクトは発生しない設計だが、念のため定期的に `wrangler r2 object list` 等で確認する

## Cloudflare Access 設定

対象ドメイン・アプリケーションの登録と許可ユーザーのポリシーは Cloudflare ダッシュボードで設定済み（2026-09 時点）。アプリケーション側でも `Cf-Access-Jwt-Assertion` の署名・issuer・audience・有効期限を検証し、Workers への直接アクセスを拒否する。

### Access アプリケーションと許可ポリシー

1. Cloudflare Zero Trust ダッシュボードの「Access」→「Applications」で Self-hosted アプリケーションを作成し、CANSHI の公開ホスト名を登録する
2. Allow ポリシーに利用を許可するメールアドレスまたはグループだけを登録する
3. メンバー変更時はこの Allow ポリシーを更新し、アプリ内にはユーザー情報を持たせない
4. アプリケーションの Overview から Application Audience（AUD）タグを控える
5. Zero Trust の Team domain（`https://<team-name>.cloudflareaccess.com`）を控える

Access は公開ホスト名へのリクエストをエッジで遮断する。アプリケーション側の JWT 検証は、`workers.dev` 等から Worker に直接到達した場合に備えた多層防御である。

### Workers の環境変数

Workers の Settings → Variables and Secrets に、次の Runtime 変数を設定する。どちらも秘密情報ではないが、環境ごとに異なるためリポジトリには値を保存しない。

- `CLOUDFLARE_ACCESS_TEAM_DOMAIN`：`https://<team-name>.cloudflareaccess.com`
- `CLOUDFLARE_ACCESS_AUD`：Access アプリケーションの AUD タグ

`CLOUDFLARE_ACCESS_BYPASS` は本番環境に設定しない。未設定または `true` 以外では検証が有効になり、Team domain・AUD・JWT のいずれかが不正なら `403 Forbidden` を返す。

`pnpm cf:deploy` は `--keep-vars` を付けてデプロイするため、ダッシュボード上の Runtime 変数を保持する。初回デプロイ前に上記2変数を設定する。

### ローカル確認

通常の `pnpm dev` と Docker Compose はカスタム Worker の入口を通らないため、従来どおり Access なしで動作する。Workers ランタイムでプレビューする場合は、ローカル専用の `.dev.vars` で検証をバイパスする。

```bash
cp .dev.vars.example .dev.vars
pnpm cf:preview
```

本番相当の確認ではバイパスを削除し、Team domain と AUD を設定したうえで次を確認する。

- 公開ホスト名を Access 経由で開くと画面・静的アセット・メディアを取得できる
- JWT ヘッダーなしで Worker に直接アクセスすると `403 Forbidden` になる
- 別アプリケーション向けまたは期限切れの JWT でも `403 Forbidden` になる

公開鍵は `{Team domain}/cdn-cgi/access/certs` から取得し、Cloudflare の鍵ローテーションに追従する。取得した公開鍵は Worker isolate 内でキャッシュされる。

## 監視・運用（TODO）

- エラー監視・ログの方針
- D1・R2 の利用量・コストの監視
- バックアップ方針（D1・R2）

## 備考

本ファイルは実装の進行に合わせて更新する。各 TODO は該当する実装 PR（`docs/plans/`）に着手する前に内容を確定させること。
