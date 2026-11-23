# @canshi/admin

CANSHI の運用者向けの管理画面。メインアプリ（`canshi`）とは別の
Cloudflare Workers（Worker 名 `canshi-admin`）として動作し、`admin.canshi.app` で公開する。

画面は React の SPA（`src/client/`）で、`vite build` で `dist/client` に書き出し、Workers の静的アセット
（`wrangler.jsonc` の `assets`）として配信する。サーバーは [Hono](https://hono.dev/) の JSON の API
（`/api/*`、`src/app.ts`）だけを持ち、画面はこの API を呼んで表示・書き込みを行う。

すべてのリクエストを Worker が受け（`assets.run_worker_first`）、`/api/*` は API で、それ以外は静的アセットで
返す。静的アセットにないパス（`/users` など）は SPA の `index.html` を返し（`not_found_handling`）、
react-router が表示するページを決める。Worker を通すため、画面の HTML にも `secureHeaders` のヘッダーが付く。

基本的には閲覧用で、書き込みはユーザーの権限の変更と、ユーザーをすべての端末からログアウトさせる
操作、家へのメンバーの追加・削除、共通のごはん商品の登録・編集・削除、共通のごはん商品のリクエストの
完了だけを持つ。

## ページ

| パス | 内容 |
| --- | --- |
| `/` | ユーザー・家・猫の件数と、家に所属していない猫の数（`pnpm household:link` の実行漏れの検知） |
| `/users` | ユーザーの一覧（権限・所属する家・有効なログインセッションの数と期限）。表示だけで、操作は名前から開く詳細で行う |
| `/users/:userId` | ユーザーの詳細（ID・権限・登録日時と更新日時・所属する家とその権限と参加日時・ログイン中の端末（有効なセッションの端末名・ログインした日時・期限）・通知を受け取る端末（Web Push の購読の端末名・登録日時・最後に送れた日時・続けて送れなかった回数））。権限を変えるフォームと、ログイン中の端末があれば「すべての端末からログアウト」ボタンを表示する（ユーザーの操作はこのページでだけ行う）。メールアドレス・セッションのトークン・購読の送り先と鍵は表示しない |
| `/households` | 家の一覧（メンバーとその権限・猫の数）。表示だけで、操作は名前から開く詳細で行う |
| `/households/:householdId` | 家の詳細（ID・作成日時と更新日時・メンバーとその権限と参加日時・猫（性別・生年月日・メモリーへ移した日・登録日時）・招待（状態・招待した人・参加したユーザー・作成日時・期限））。まだメンバーでないユーザーを追加するフォームと、オーナー以外のメンバーを外すボタンを表示する（家の操作はこのページでだけ行う）。招待のトークンは表示しない |
| `/food-products` | 共通のごはん商品の一覧（画像・区分・カロリー・内容量・対象・家に追加された数）。どの家のユーザーも、メインアプリでごはん商品を登録するときに検索して家に追加できる。メーカーごとに折りたたんで表示し（メーカー名のない商品は最後にまとめる）、まとまりごとの検索フォームで、そのメーカーの商品を商品名・検索キーワードで絞り込める（`?manufacturer=<メーカー名>&q=<検索語>`。メーカー名のないまとまりは `manufacturer` を空にする）。検索したまとまりと、登録・更新した商品のまとまりだけを開いて表示する。閉じているまとまりの中身は描かない（商品が数百件あると、パスワードマネージャーの拡張機能が開くたびに DOM 全体を調べ直してページが固まるため） |
| `/food-products/new` | 共通のごはん商品の登録フォーム |
| `/food-products/:productId/edit` | 共通のごはん商品の編集フォーム |
| `/food-product-requests` | 共通のごはん商品のリクエストの一覧。ユーザーがメインアプリで検索して見つからなかったときに送った検索条件を、対応を待っているもの（古い順）と完了にしたもの（新しい順に 50 件）に分けて表示する |
| `/ai-connections` | AI のアプリ（MCP クライアント）のプロバイダーごとの、有効な接続の件数（アイコン・プロバイダー・接続件数）。詳しくは下の「AIとの接続」を参照 |

ログアウトさせる・家から外す・商品を削除する・リクエストを完了にする操作は、確認のダイアログを出してから行う。
書き込みが終わると、結果を表示する URL（`/users/<ID>?roleChange=updated`・`/users/<ID>?loggedOut=1`・
`/households/<ID>?memberChange=added&user=<ID>`・`/food-products?catalogChange=created&product=<ID>`・
`/food-product-requests?completion=completed&request=<ID>` など）へ移動する。同じ URL を開けば結果の表示を
再現できるため、VRT では書き込まずに撮る。

## API

| パス | 内容 |
| --- | --- |
| `GET /api/overview` | 概要の件数 |
| `GET /api/users` | ユーザーの一覧 |
| `GET /api/users/:userId` | ユーザーの詳細。見つからなければ 404 |
| `POST /api/users/:userId/role` | JSON の `role`（`admin` または `member`）にユーザーのアプリ全体の権限（`users.role`）を変える。選べない権限なら 400 |
| `DELETE /api/users/:userId/sessions` | ユーザーのログインセッションをすべて削除する（すべての端末からログアウトさせる） |
| `GET /api/households` | 家の一覧 |
| `GET /api/households/:householdId` | 家の詳細と、メンバーとして追加する候補（全ユーザーの ID と名前）。見つからなければ 404 |
| `POST /api/households/:householdId/members` | JSON の `userId` のユーザーを家のメンバー（`member`）として追加する。すでにメンバーなら 400 |
| `DELETE /api/households/:householdId/members/:userId` | ユーザーを家から外す。家にオーナーがいなくならないよう、オーナーは外せない（400。メインアプリでオーナーを移譲してから外す） |
| `GET /api/food-products` | 共通のごはん商品の一覧（メーカー名・商品名の順） |
| `POST /api/food-products` | 共通のごはん商品を登録する（`multipart/form-data`。項目は `src/catalog/form.ts`）。入力に誤りがあれば 400、保存容量の上限を超えるなら 507 で、項目ごとのエラーを返す |
| `GET /api/food-products/:productId` | 共通のごはん商品 1 件 |
| `PUT /api/food-products/:productId` | 共通のごはん商品を更新する。画像を選び直したとき・削除を選んだときは古い画像を削除する。家に追加済みの商品は内容を写したものなので変わらない |
| `DELETE /api/food-products/:productId` | 共通のごはん商品と画像を削除する。家に追加済みの商品は残り、追加元（`food_products.catalog_food_product_id`）だけが NULL になる |
| `GET /api/food-products/:productId/image` | 共通のごはん商品の画像（一覧・編集フォームで表示する） |
| `GET /api/food-product-requests` | 共通のごはん商品のリクエストの一覧（対応を待っているものと完了にしたもの） |
| `POST /api/food-product-requests/:requestId/complete` | リクエストを完了にし、リクエストしたユーザーへの通知を作る（Push はメインアプリの次の定期送信で送る）。完了は取り消せない。すでに完了なら `already-completed` を返す |
| `GET /api/ai-connections` | AI のアプリのプロバイダーごとの接続の件数と、アプリが名乗った名前。grant・クライアントの ID、ユーザー、トークンは返さない |

API の JSON の型は `src/api/types.ts` にあり、画面とサーバーの両方で使う（日時は ISO 8601 の文字列）。
画面とサーバーで共用するファイル（`src/api/`・`src/models.ts`・`src/catalog/form.ts`・`search.ts`・`image.ts`）は、
D1・Drizzle・Workers の型に依存させない。

書き込み（GET・HEAD 以外）は、`Origin` が同じオリジンのものだけを受け付ける（Cloudflare Access の Cookie は、
ほかのサイトからの送信にも付きうるため。ブラウザは GET・HEAD 以外の送信には同じオリジンでも `Origin` を付ける）。
API の応答には `Cache-Control: no-store` を付け、全ユーザー・全家の情報をキャッシュに残さない。

## 見た目

見た目はメインアプリのデザインルール（[`docs/idea/design.md`](../../docs/idea/design.md)）に揃え、
UI コンポーネント（Button・Table・Select・Modal・Collapsible など）とデザイントークン（`tokens.css`）は
メインアプリと同じ [`@canshi/shared`](../shared) のものを使う。リンクを含むコンポーネントには、react-router の
リンクを差し込んだ `RouterLink`（`src/client/RouterLink.tsx`）を `linkComponent` で渡す。
ダークテーマ・コントラスト・文字サイズの切り替えは持たず、`index.html` の `<html>` に `data-theme="light"` を
付けてライトテーマに固定する。メインアプリでトークンや部品を変えると、管理画面の見た目も同じように変わる。

## 開発コマンド

リポジトリルートから `pnpm --filter @canshi/admin <script>` で実行するか、このディレクトリで直接
実行する。

```bash
pnpm dev         # 画面をビルドしてから wrangler dev でローカル起動（メインアプリのローカル D1 を参照する）
pnpm dev:client  # 画面だけを Vite の開発サーバーで動かす（API は別に起動した pnpm dev の 8787 番へ送る）
pnpm build       # 画面を dist/client にビルドする（vite build）
pnpm typecheck   # tsc -b（サーバーは tsconfig.worker.json、画面は tsconfig.client.json）
pnpm test        # vitest run（サーバーは node、画面は jsdom で実行する）
pnpm cf-typegen  # wrangler.jsonc から worker-configuration.d.ts を再生成
pnpm run deploy  # 画面をビルドしてから wrangler deploy（通常は main へのマージで Workers Builds が実行する）
pnpm run preview # 画面をビルドしてから wrangler preview --ignore-base-config（通常は main 以外のブランチで Workers Builds が実行する）
```

`dist/client` は `.gitignore` に入れている。`pnpm dev`・`deploy`・`preview` は先に `vite build` を実行するため、
Workers Builds の設定（ビルドコマンド・デプロイコマンド）を変える必要はない。

### 依存関係

メインアプリと管理画面（と共通のパッケージ）で使うパッケージ（`drizzle-orm`・`wrangler`・`vitest`・
`vite`・`react-aria-components` など）は、
[pnpm の catalogs](https://pnpm.io/ja/catalogs) でバージョンをまとめて管理している。
バージョンはリポジトリルートの `pnpm-workspace.yaml` の `catalog` に書き、各 `package.json` では
`"catalog:"` と書く。両方で使うパッケージを足すときも `catalog` に追加する。

### ローカルでの起動

`pnpm dev` は `--persist-to ../../.wrangler/state` でメインアプリと同じローカル D1 を参照する。
テーブルが無い場合は、先にリポジトリルートで `pnpm db:migrate:local` を実行しておく。

`pnpm dev` は起動するときに画面を 1 回ビルドするだけで、画面のファイルを変えても作り直さない。画面を
直しながら確かめるときは、`pnpm dev` を起動したまま別の端末で `pnpm dev:client` を起動し、Vite の開発サーバー
（既定で 5173 番）を開く。

### ビジュアルリグレッションテスト（VRT）

管理画面の見た目は、メインアプリの VRT とは別に reg-suit で比較する。spec は
リポジトリルートの `e2e-admin/vrt.spec.ts`、設定は `playwright.admin-vrt.config.ts` と
`regconfig.admin.json` にある。データはメインアプリの VRT と同じ固定フィクスチャ
（`e2e/fixtures/vrt-seed.sql`）を使う。

比較はメインアプリの VRT と同じく、1 ピクセルでも違えば差分にし、色の差のしきい値
（`matchingThreshold`）だけ 0.01 にして、実行のたびに揺れるアンチエイリアスの差を無視する
（理由は `e2e/vrt-snapshot.ts` の冒頭のコメントを参照）。

CI の `vrt-admin` ジョブは、main への push では毎回、PR では管理画面に関わるファイル
（このパッケージ・`e2e-admin/`・VRT の設定とフィクスチャ・マイグレーション・
依存関係（`pnpm-workspace.yaml` の catalog を含む）・ワークフロー）を変えたときだけ実行する。結果は PR に「管理画面の VRT (reg-suit) 結果」として
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
ポリシーではなく、`admin.canshi.app` の Self-hosted アプリケーションに管理者だけを
許可するポリシーを付けて保護する。Self-hosted アプリケーションは Workers 全体の Access より
優先され、Workers 全体の Access が適用されないカスタムドメインも確実に保護できる。

ユーザーの権限（`users.role`）の「管理者」（`admin`）は、MCP から管理画面の一部の操作を行えるように
するなど、アプリの中での権限を表すもので、管理画面に入れるかどうかとは関係しない。管理者にしたユーザーを管理画面に入れたいときは、
Access のポリシーにも別途追加すること。

Self-hosted アプリケーションはデプロイする前に作ること。手順は
[`docs/deploy.md`](../../docs/deploy.md) の「管理画面」節を参照。

## デプロイとプレビュー

`main` にマージされると、管理画面に関わるファイル（`packages/admin/` など）が変わっていれば
Cloudflare の Workers Builds が自動でデプロイする。`main` 以外のブランチでは、Worker Previews で
プレビュー専用の D1・R2 を使うプレビューが作られる。プレビューの URL も、管理者だけを許可する
Worker 単位の Access で保護する。設定と確認の手順は [`docs/deploy.md`](../../docs/deploy.md) の
「管理画面の自動デプロイとプレビュー」節を参照。

## 共通のごはん商品の画像

画像は選んだときに開くダイアログ（`src/client/components/ImageCropModal.tsx`）で範囲を選ばせ、
ブラウザで一辺 800px 以下の正方形の JPEG に切り抜いてから送り（EXIF の位置情報なども落ちる）、サムネイルは作らずに
そのまま R2 に保存する。Workers では画像をデコード・再エンコードしないため、サーバーでも切り抜いた形
（1MB 以下・一辺 800px 以下の正方形で、Exif・XMP・IPTC のセグメントを持たない JPEG）であることを
JPEG のマーカーから確かめ、画面を通さずに送られたなどで元のまま届いた画像は断る（`src/catalog/image.ts`）。

画像は 1 商品に 1 枚。差し替えでは、更新と同じ batch の中でその時点の画像の行をすべて削除してから
新しい行を追加するため、同時に差し替えても 1 枚だけが残る（削除した行の R2 のオブジェクトも消す）。
保存する前に、メインアプリのメディアと同じ保存容量の上限（`MEDIA_STORAGE_LIMIT_BYTES`、未設定なら
10GB）を超えないかを確かめる（`src/catalog/storage.ts`）。メインアプリで上限を設定したときは、
管理画面の Worker にも同じ値を設定すること。

保存先はメインアプリのメディアと同じく `media_assets`（`record_type = 'catalog_food_product'`）と
R2 の `catalog_food_product/{商品の ID}/{asset ID}`。メインアプリでは、ログイン中のユーザーなら誰でも
参照できるが削除はできない。家に追加するときは、メインアプリが通常のアップロードと同じ経路で家の
商品の画像として保存し直す（R2 のオブジェクトは共有しない）。

## AIとの接続

`/ai-connections` は、ユーザーがメインアプリの同意画面で AI のアプリ（MCP クライアント）に許可した、有効な
接続（OAuth の grant）の件数をプロバイダーごとに表示する（`src/db/mcpConnections.ts`）。メインアプリの
設定の「AIとの接続」（`src/features/mcp/infrastructure/connections.ts`）と同じく、MCP の認可サーバー
（`@cloudflare/workers-oauth-provider`）が `oauth_kv_entries` に保存した `grant:{userId}:{grantId}`・
`client:{clientId}` を直接読む。期限の切れた grant・行は数えない。

プロバイダーは、メインアプリのアイコンと同じく、grant に記録された認可コードの渡し先のドメインで見分ける
（`detectMcpClientApp`）。アイコンを設定済みのアプリ（`MCP_CLIENT_APPS`）は接続が無くても 0 件で並べ、
見分けられないプロバイダーは「アイコン未設定」として、渡し先のホスト（https 以外はスキームも付ける）ごとに、
アプリが名乗った名前（自己申告）を添えて接続の多い順に並べる。見分けられないプロバイダーとの接続があるときは、
メインアプリの次の 3 か所にアプリを足すよう促す。

- `src/features/mcp/domain/clientApp.ts`：`MCP_CLIENT_APPS` と、接続先のドメイン（`CLIENT_APP_DOMAINS`）
- `src/features/mcp/domain/labels.ts`：表示名（`MCP_CLIENT_APP_LABEL`）
- `src/features/mcp/presentation/clientIcons.ts`：アイコン（`MCP_CLIENT_APP_ICON`）

## D1・R2 の参照

メインアプリと同じ D1（`canshi-db`）をバインディング `DB` で、同じ R2（`canshi-media`）を
バインディング `MEDIA_BUCKET` で直接参照する。マイグレーションはメインアプリ（リポジトリルートの
`drizzle/`）が管理し、このパッケージは SELECT と、ユーザーの権限を変える UPDATE（`users` テーブルの
`role` 列）、ユーザーのセッションを削除する DELETE（`sessions` テーブル）、家のメンバーを追加・削除する
INSERT・DELETE（`household_members` テーブル）、
共通のごはん商品を登録・更新・削除する INSERT・UPDATE・DELETE（`catalog_food_products` テーブルと、
その画像の `media_assets` の行）だけを発行する。MCP の OAuth のデータ（`oauth_kv_entries` テーブル）は
読み出すだけで書き込まない。R2 は共通のごはん商品の画像の保存・削除だけに使う。

D1 の読み書きは、メインアプリの Drizzle スキーマ（リポジトリルートの `src/db/schema`。
`src/db/schema.ts` から再 export する）を使って Drizzle で行い、SQL を文字列で組み立てない
（値はすべてバインドパラメーターで渡す）。条件付きの INSERT はメインアプリの
`src/db/conditionalInsert.ts` の `insertWhere` を使う。セッション・通知の購読の User-Agent は、
メインアプリの端末一覧と同じ `src/features/auth/domain/deviceName.ts` の `formatDeviceName` で端末名にする。
AI のアプリの見分け方・表示名・アイコンは、メインアプリの `src/features/mcp/domain/clientApp.ts`・
`labels.ts`・`src/features/mcp/presentation/clientIcons.ts` を使う（上の「AIとの接続」）。
どれも `drizzle-orm`・`react-icons` と相対パスだけを import する（または何も import しない）ため、Next.js 向けの
tsconfig・パスエイリアスには依存しない。
メインアプリでテーブル・列を変更したときは、管理画面のクエリもスキーマに合わせて型が変わるので、
`pnpm --filter @canshi/admin typecheck`・`test` で確かめること。ごはん商品の入力の規則を変えたときは
`src/catalog/form.ts` も合わせて更新する。`src/db/queries.test.ts` などはリポジトリ
ルートの `drizzle/` のマイグレーションをすべて適用した DB（sql.js を D1 の形に包んだもの。
`src/test/d1.ts`）で実行するため、スキーマとマイグレーションの食い違いもテストで検出できる。

Drizzle の D1 ドライバーは、`batch` の結果を列名をキーにしたオブジェクトから並べ直すため、
同じ列名（`name` など）を持つテーブルを結合した SELECT を `batch` に入れると値を取り違える。
読み取りは `batch` に入れず、`Promise.all` で並べること。
