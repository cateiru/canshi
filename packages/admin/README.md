# @canshi/admin

CANSHI の運用者向けの管理画面。メインアプリ（`canshi`）とは別の
Cloudflare Workers（Worker 名 `canshi-admin`）として動作し、`canshi-admin.cateiru.dev` で公開する。
[Hono](https://hono.dev/) の JSX でサーバーサイドレンダリングする。

基本的には閲覧用で、書き込みはユーザーをすべての端末からログアウトさせる操作と、家へのメンバーの
追加・削除だけを持つ。

| パス | 内容 |
| --- | --- |
| `/` | ユーザー・家・猫の件数と、家に所属していない猫の数（`pnpm household:link` の実行漏れの検知） |
| `/users` | ユーザーの一覧（権限・所属する家・有効なログインセッションの数と期限）。有効なセッションがあるユーザーには「すべての端末からログアウト」ボタンを表示する |
| `/households` | 家の一覧（メンバーとその権限・猫の数）。家ごとに、まだメンバーでないユーザーを追加するフォームと、オーナー以外のメンバーを外すボタンを表示する |
| `POST /users/:userId/sessions/delete` | ユーザーのログインセッションをすべて削除する（すべての端末からログアウトさせる）。終わると `/users` に戻る |
| `POST /households/:householdId/members` | フォームの `userId` のユーザーを家のメンバー（`member`）として追加する。すでにメンバーなら何もしない。終わると `/households` に戻る |
| `POST /households/:householdId/members/:userId/delete` | ユーザーを家から外す。家にオーナーがいなくならないよう、オーナーは外せない（メインアプリでオーナーを移譲してから外す）。終わると `/households` に戻る |

書き込みを伴う `POST` は、Hono の CSRF ミドルウェアで同じオリジンからの送信だけを受け付ける
（Cloudflare Access の Cookie は、ほかのサイトからのフォーム送信にも付きうるため）。

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

### ビジュアルリグレッションテスト（VRT）

管理画面の見た目は、メインアプリの VRT とは別に reg-suit で比較する。spec は
リポジトリルートの `e2e-admin/vrt.spec.ts`、設定は `playwright.admin-vrt.config.ts` と
`regconfig.admin.json` にある。データはメインアプリの VRT と同じ固定フィクスチャ
（`e2e/fixtures/vrt-seed.sql`）を使う。

CI の `vrt-admin` ジョブは、main への push では毎回、PR では管理画面に関わるファイル
（このパッケージ・`e2e-admin/`・VRT の設定とフィクスチャ・マイグレーション・依存関係・
ワークフロー）を変えたときだけ実行する。結果は PR に「管理画面の VRT (reg-suit) 結果」として
コメントされる。

ローカルではリポジトリルートで次のように実行する（`pnpm vrt:admin` が `pnpm dev` を起動する）。
スクリーンショットは `vrt-screenshots/admin/actual` に書き出される。

```bash
pnpm db:migrate:local && pnpm vrt:seed  # 初回のみ
pnpm vrt:admin
```

## アクセス制御

管理画面はアプリ内では認証せず、Cloudflare Access に任せる。家ごとの絞り込みをせず全ユーザー・
全家の情報を表示するため、メインアプリの利用者（家族など）を含む Workers 全体の Access の
ポリシーではなく、`canshi-admin.cateiru.dev` の Self-hosted アプリケーションに管理者だけを
許可するポリシーを付けて保護する。Self-hosted アプリケーションは Workers 全体の Access より
優先され、Workers 全体の Access が適用されないカスタムドメインも確実に保護できる。

Self-hosted アプリケーションはデプロイする前に作ること。手順は
[`docs/deploy.md`](../../docs/deploy.md) の「管理画面」節を参照。

## D1 の参照

メインアプリと同じ D1（`canshi-db`）をバインディング `DB` で直接参照する。マイグレーションは
メインアプリ（リポジトリルートの `drizzle/`）が管理し、このパッケージは SELECT と、
ユーザーのセッションを削除する DELETE（`sessions` テーブル）、家のメンバーを追加・削除する
INSERT・DELETE（`household_members` テーブル）だけを発行する。

メインアプリの Drizzle スキーマ（`src/db/schema`）は import せず、`src/db/queries.ts` に生の SQL で
書いている（パッケージ境界をまたぐと Next.js 向けの tsconfig・パスエイリアスに連鎖的に依存して
しまうため）。メインアプリでテーブル・列を
変更したときは `src/db/queries.ts` も合わせて更新すること。`src/db/queries.test.ts` はリポジトリ
ルートの `drizzle/` のマイグレーションをすべて適用した DB（sql.js）で実行するため、列名の
食い違いはテストで検出できる。
