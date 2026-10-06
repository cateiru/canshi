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

ローカルには Cloudflare Access が無いため、`.dev.vars.example` を `.dev.vars` にコピーして
`ACCESS_DEV_BYPASS=true` を設定すると、Access の JWT の検証を省略できる。この設定はリクエストの
ホスト名が `localhost`・`127.0.0.1` のときだけ効き、本番のホスト名では無視される。
`wrangler dev` は既定では `routes` のホスト名（`canshi-admin.cateiru.dev`）でリクエストの URL を
書き換えるため、`pnpm dev` では `--local-upstream localhost` を指定している。

```bash
cp .dev.vars.example .dev.vars
pnpm dev
```

## Cloudflare Access による保護

管理画面は全ユーザー・全家の情報を表示するため、Cloudflare Access で管理者だけに公開する。

メインアプリは「Workers 全体の Access（Protect all Workers）」で保護されている前提で、アプリ内では
Access の JWT を検証しない（`docs/plans/15_cloudflare_access.md`）。しかし MCP サーバーの導入時に、
MCP サーバーのカスタムドメインにはこの Workers 全体の Access が適用されなかったことを確認している
（[`docs/deploy.md`](../../docs/deploy.md) の「MCP サーバー」節）。管理画面はそれに頼らず、次の 2 段で守る。

1. Zero Trust で `canshi-admin.cateiru.dev` の Self-hosted アプリケーションを作成し、管理者だけを
   許可するポリシーを付ける（エッジでの保護。手順は `docs/deploy.md` の「管理画面」節）
2. Worker 内でも、すべてのリクエストで `Cf-Access-Jwt-Assertion` ヘッダーの JWT を検証する
   （`src/auth/access.ts`）。署名は Team domain の `/cdn-cgi/access/certs` の鍵で、`aud` は
   Self-hosted アプリの AUD タグ（`wrangler.jsonc` の `ACCESS_AUD`）で確かめる。
   `ACCESS_AUD` が空のときや JWT が無い・不正なときは `403` を返す（fail closed）

アプリ内のユーザー（`users.role`）と Access のアカウント（メールアドレス）は紐付いていないため、
誰が管理画面を使えるかは Access のポリシーだけで決まる。

## D1 の参照

メインアプリと同じ D1（`canshi-db`）をバインディング `DB` で直接参照する。マイグレーションは
メインアプリ（リポジトリルートの `drizzle/`）が管理し、このパッケージは SELECT だけを発行する。

メインアプリの Drizzle スキーマ（`src/db/schema`）は import せず、`src/db/queries.ts` に生の SQL で
書いている（パッケージ境界をまたぐと Next.js 向けの tsconfig・パスエイリアスに連鎖的に依存して
しまうため。MCP サーバーの `src/rpc/mainApp.ts` と同じ理由）。メインアプリでテーブル・列を
変更したときは `src/db/queries.ts` も合わせて更新すること。`src/db/queries.test.ts` はリポジトリ
ルートの `drizzle/` のマイグレーションをすべて適用した DB（sql.js）で実行するため、列名の
食い違いはテストで検出できる。
