# @canshi/admin

CANSHI の運用者向けの管理画面。メインアプリ（`canshi`）とは別の
Cloudflare Workers（Worker 名 `canshi-admin`）として動作し、`canshi-admin.cateiru.dev` で公開する。
[Hono](https://hono.dev/) の JSX でサーバーサイドレンダリングする。

基本的には閲覧用で、書き込みはユーザーをすべての端末からログアウトさせる操作と、家へのメンバーの
追加・削除、共通のごはん商品の登録・編集・削除だけを持つ。

| パス | 内容 |
| --- | --- |
| `/` | ユーザー・家・猫の件数と、家に所属していない猫の数（`pnpm household:link` の実行漏れの検知） |
| `/users` | ユーザーの一覧（権限・所属する家・有効なログインセッションの数と期限）。有効なセッションがあるユーザーには「すべての端末からログアウト」ボタンを表示する |
| `/households` | 家の一覧（メンバーとその権限・猫の数）。家ごとに、まだメンバーでないユーザーを追加するフォームと、オーナー以外のメンバーを外すボタンを表示する |
| `POST /users/:userId/sessions/delete` | ユーザーのログインセッションをすべて削除する（すべての端末からログアウトさせる）。終わると `/users` に戻る |
| `POST /households/:householdId/members` | フォームの `userId` のユーザーを家のメンバー（`member`）として追加する。すでにメンバーなら何もしない。終わると `/households` に戻る |
| `POST /households/:householdId/members/:userId/delete` | ユーザーを家から外す。家にオーナーがいなくならないよう、オーナーは外せない（メインアプリでオーナーを移譲してから外す）。終わると `/households` に戻る |
| `/food-products` | 共通のごはん商品の一覧（画像・区分・カロリー・内容量・対象・家に追加された数）。どの家のユーザーも、メインアプリでごはん商品を登録するときに検索して家に追加できる |
| `/food-products/new` | 共通のごはん商品の登録フォーム |
| `POST /food-products` | 共通のごはん商品を登録する。終わると `/food-products` に戻る |
| `/food-products/:productId/edit` | 共通のごはん商品の編集フォーム |
| `POST /food-products/:productId` | 共通のごはん商品を更新する。画像を選び直したとき・削除を選んだときは古い画像を削除する。家に追加済みの商品は内容を写したものなので変わらない。終わると `/food-products` に戻る |
| `POST /food-products/:productId/delete` | 共通のごはん商品と画像を削除する。家に追加済みの商品は残り、追加元（`food_products.catalog_food_product_id`）だけが NULL になる。終わると `/food-products` に戻る |
| `/food-products/:productId/image` | 共通のごはん商品の画像（一覧・編集フォームで表示する） |

見た目はメインアプリのデザインルール（[`docs/idea/design.md`](../../docs/idea/design.md)）に揃え、
`src/views/styles.ts` にメインアプリの `src/styles/tokens.css` と同じトークンを写して使う。
ダークテーマ・コントラスト・文字サイズの切り替えは持たず、ライトテーマに固定する。
メインアプリでトークンの値を変えたときは `src/views/styles.ts` も合わせて更新すること
（`src/views/styles.test.ts` が `tokens.css` と照合するため、食い違いはテストで検出できる）。

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

## 共通のごはん商品の画像

画像はブラウザで長辺 800px の JPEG に縮小してから送り（フォームのスクリプト。EXIF の位置情報なども
落ちる）、サムネイルは作らずにそのまま R2 に保存する。Workers では画像をデコード・再エンコードしない
ため、サーバーでも縮小した形（1MB 以下・長辺 800px 以下で、Exif・XMP・IPTC のセグメントを持たない
JPEG）であることを JPEG のマーカーから確かめ、スクリプトが動かなかった・縮小が終わる前に送られた
などで元のまま届いた画像は断る（`src/catalog/image.ts`）。

画像は 1 商品に 1 枚。差し替えでは、更新と同じ batch の中でその時点の画像の行をすべて削除してから
新しい行を追加するため、同時に差し替えても 1 枚だけが残る（削除した行の R2 のオブジェクトも消す）。
保存する前に、メインアプリのメディアと同じ保存容量の上限（`MEDIA_STORAGE_LIMIT_BYTES`、未設定なら
10GB）を超えないかを確かめる（`src/catalog/storage.ts`）。メインアプリで上限を設定したときは、
管理画面の Worker にも同じ値を設定すること。

保存先はメインアプリのメディアと同じく `media_assets`（`record_type = 'catalog_food_product'`）と
R2 の `catalog_food_product/{商品の ID}/{asset ID}`。メインアプリでは、ログイン中のユーザーなら誰でも
参照できるが削除はできない。家に追加するときは、メインアプリが通常のアップロードと同じ経路で家の
商品の画像として保存し直す（R2 のオブジェクトは共有しない）。

## D1・R2 の参照

メインアプリと同じ D1（`canshi-db`）をバインディング `DB` で、同じ R2（`canshi-media`）を
バインディング `MEDIA_BUCKET` で直接参照する。マイグレーションはメインアプリ（リポジトリルートの
`drizzle/`）が管理し、このパッケージは SELECT と、ユーザーのセッションを削除する DELETE
（`sessions` テーブル）、家のメンバーを追加・削除する INSERT・DELETE（`household_members` テーブル）、
共通のごはん商品を登録・更新・削除する INSERT・UPDATE・DELETE（`catalog_food_products` テーブルと、
その画像の `media_assets` の行）だけを発行する。R2 は共通のごはん商品の画像の保存・削除だけに使う。

メインアプリの Drizzle スキーマ（`src/db/schema`）は import せず、`src/db/queries.ts` に生の SQL で
書いている（パッケージ境界をまたぐと Next.js 向けの tsconfig・パスエイリアスに連鎖的に依存して
しまうため）。メインアプリでテーブル・列を変更したときは `src/db/queries.ts`・
`src/db/catalogFoodProducts.ts` も、ごはん商品の入力の規則を変えたときは `src/catalog/form.ts` も
合わせて更新すること。`src/db/queries.test.ts` はリポジトリ
ルートの `drizzle/` のマイグレーションをすべて適用した DB（sql.js）で実行するため、列名の
食い違いはテストで検出できる。
