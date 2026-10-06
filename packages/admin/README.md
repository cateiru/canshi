# @canshi/admin

CANSHI の運用者向けの管理画面。メインアプリ（`canshi`）・MCP サーバー（`canshi-mcp`）とは別の
Cloudflare Workers（Worker 名 `canshi-admin`）として動作し、`canshi-admin.cateiru.dev` で公開する。
[Hono](https://hono.dev/) の JSX でサーバーサイドレンダリングする。

現時点では閲覧専用で、次の画面を持つ。

| パス | 内容 |
| --- | --- |
| `/` | ユーザー・家・猫の件数と、家に所属していない猫の数（`pnpm household:link` の実行漏れの検知） |
| `/users` | ユーザーの一覧（権限・所属する家・有効なログインセッションの数と期限） |
| `/households` | 家の一覧（メンバーとその権限・猫の数） |

## 開発コマンド

リポジトリルートから `pnpm --filter @canshi/admin <script>` で実行するか、このディレクトリで直接
実行する。

```bash
pnpm dev         # wrangler dev でローカル起動（メインアプリのローカル D1 を参照する）
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
pnpm cf-typegen  # wrangler.jsonc から worker-configuration.d.ts を再生成
pnpm deploy      # wrangler deploy
```

### ローカルでの起動

`pnpm dev` は `--persist-to ../../.wrangler/state` でメインアプリと同じローカル D1 を参照する。
テーブルが無い場合は、先にリポジトリルートで `pnpm db:migrate:local` を実行しておく。

## アクセス制御

管理画面はアプリ内では認証せず、Cloudflare Access に任せる。家ごとの絞り込みをせず全ユーザー・
全家の情報を表示するため、メインアプリの利用者（家族など）を含む Workers 全体の Access の
ポリシーではなく、`canshi-admin.cateiru.dev` の Self-hosted アプリケーションに管理者だけを
許可するポリシーを付けて保護する。Self-hosted アプリケーションは Workers 全体の Access より
優先され、Workers 全体の Access が適用されなかったカスタムドメイン（MCP サーバーで確認済み）も
確実に保護できる。

Self-hosted アプリケーションはデプロイする前に作ること。手順は
[`docs/deploy.md`](../../docs/deploy.md) の「管理画面」節を参照。

## D1 の参照

メインアプリと同じ D1（`canshi-db`）をバインディング `DB` で直接参照する。マイグレーションは
メインアプリ（リポジトリルートの `drizzle/`）が管理し、このパッケージは SELECT だけを発行する。

メインアプリの Drizzle スキーマ（`src/db/schema`）は import せず、`src/db/queries.ts` に生の SQL で
書いている（パッケージ境界をまたぐと Next.js 向けの tsconfig・パスエイリアスに連鎖的に依存して
しまうため。MCP サーバーの `src/rpc/mainApp.ts` と同じ理由）。メインアプリでテーブル・列を
変更したときは `src/db/queries.ts` も合わせて更新すること。`src/db/queries.test.ts` はリポジトリ
ルートの `drizzle/` のマイグレーションをすべて適用した DB（sql.js）で実行するため、列名の
食い違いはテストで検出できる。
