# @canshi/admin

CANSHI の運用者向けの管理画面。メインアプリ（`canshi`）とは別の
Cloudflare Workers（Worker 名 `canshi-admin`）として動作し、`admin.canshi.app` で公開する。
[Hono](https://hono.dev/) の JSX でサーバーサイドレンダリングする。

基本的には閲覧用で、書き込みはユーザーの権限の変更と、ユーザーをすべての端末からログアウトさせる
操作、家へのメンバーの追加・削除、共通のごはん商品の登録・編集・削除、共通のごはん商品のリクエストの
完了だけを持つ。

| パス | 内容 |
| --- | --- |
| `/` | ユーザー・家・猫の件数と、家に所属していない猫の数（`pnpm household:link` の実行漏れの検知） |
| `/users` | ユーザーの一覧（権限・所属する家・有効なログインセッションの数と期限）。ユーザーごとに権限を変えるフォームを、有効なセッションがあるユーザーには「すべての端末からログアウト」ボタンを表示する |
| `/households` | 家の一覧（メンバーとその権限・猫の数）。家ごとに、まだメンバーでないユーザーを追加するフォームと、オーナー以外のメンバーを外すボタンを表示する |
| `POST /users/:userId/role` | フォームの `role`（`admin` または `member`）にユーザーのアプリ全体の権限（`users.role`）を変える。終わると `/users` に戻る |
| `POST /users/:userId/sessions/delete` | ユーザーのログインセッションをすべて削除する（すべての端末からログアウトさせる）。終わると `/users` に戻る |
| `POST /households/:householdId/members` | フォームの `userId` のユーザーを家のメンバー（`member`）として追加する。すでにメンバーなら何もしない。終わると `/households` に戻る |
| `POST /households/:householdId/members/:userId/delete` | ユーザーを家から外す。家にオーナーがいなくならないよう、オーナーは外せない（メインアプリでオーナーを移譲してから外す）。終わると `/households` に戻る |
| `/food-products` | 共通のごはん商品の一覧（画像・区分・カロリー・内容量・対象・家に追加された数）。どの家のユーザーも、メインアプリでごはん商品を登録するときに検索して家に追加できる。メーカーごとに折りたたんで表示し（メーカー名のない商品は最後にまとめる）、まとまりごとの検索フォームで、そのメーカーの商品を商品名・検索キーワードで絞り込める（`?manufacturer=<メーカー名>&q=<検索語>`。メーカー名のないまとまりは `manufacturer` を空にする）。検索したまとまりと、登録・更新した商品のまとまりだけを開いて表示する。閉じているまとまりの中身は `<template>` に入れて DOM に置かず、開いたときにスクリプトで差し込む（商品が数百件あると、パスワードマネージャーの拡張機能が開くたびに DOM 全体を調べ直してページが固まるため）。行の削除ボタンは、ページに 1 つの削除フォームから送る |
| `/food-products/new` | 共通のごはん商品の登録フォーム |
| `POST /food-products` | 共通のごはん商品を登録する。終わると `/food-products` に戻る |
| `/food-products/:productId/edit` | 共通のごはん商品の編集フォーム |
| `POST /food-products/:productId` | 共通のごはん商品を更新する。画像を選び直したとき・削除を選んだときは古い画像を削除する。家に追加済みの商品は内容を写したものなので変わらない。終わると `/food-products` に戻る |
| `POST /food-products/:productId/delete` | 共通のごはん商品と画像を削除する。家に追加済みの商品は残り、追加元（`food_products.catalog_food_product_id`）だけが NULL になる。終わると `/food-products` に戻る |
| `/food-products/:productId/image` | 共通のごはん商品の画像（一覧・編集フォームで表示する） |
| `/food-product-requests` | 共通のごはん商品のリクエストの一覧。ユーザーがメインアプリで検索して見つからなかったときに送った検索条件を、対応を待っているもの（古い順）と完了にしたもの（新しい順に 50 件）に分けて表示する |
| `POST /food-product-requests/:requestId/complete` | リクエストを完了にし、リクエストしたユーザーへの通知を作る（Push はメインアプリの次の定期送信で送る）。完了は取り消せない。終わると `/food-product-requests` に戻る |

見た目はメインアプリのデザインルール（[`docs/idea/design.md`](../../docs/idea/design.md)）に揃え、
デザイントークンはメインアプリと同じ [`@canshi/shared`](../shared) の `tokens.css` をそのまま使う
（`src/views/styles.ts` で文字列として import し、`<style>` に埋め込む。`.css` は `wrangler.jsonc` の
`rules` で Text モジュールにし、テストでは `vitest.config.ts` のプラグインで同じように読み込む）。
ダークテーマ・コントラスト・文字サイズの切り替えは持たず、`<html>` に `data-theme="light"` を付けて
ライトテーマに固定する。メインアプリでトークンの値を変えると、管理画面の見た目も同じように変わる。

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
pnpm run deploy  # wrangler deploy（通常は main へのマージで Workers Builds が実行する）
pnpm run preview # wrangler preview --ignore-base-config（通常は main 以外のブランチで Workers Builds が実行する）
```

### 依存関係

メインアプリと管理画面の両方で使うパッケージ（`drizzle-orm`・`wrangler`・`vitest` など）は、
[pnpm の catalogs](https://pnpm.io/ja/catalogs) でバージョンをまとめて管理している。
バージョンはリポジトリルートの `pnpm-workspace.yaml` の `catalog` に書き、各 `package.json` では
`"catalog:"` と書く。両方で使うパッケージを足すときも `catalog` に追加する。

### ローカルでの起動

`pnpm dev` は `--persist-to ../../.wrangler/state` でメインアプリと同じローカル D1 を参照する。
テーブルが無い場合は、先にリポジトリルートで `pnpm db:migrate:local` を実行しておく。

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

画像は選んだときに開くダイアログで範囲を選ばせ、ブラウザで一辺 800px 以下の正方形の JPEG に
切り抜いてから送り（フォームのスクリプト。EXIF の位置情報なども落ちる）、サムネイルは作らずに
そのまま R2 に保存する。Workers では画像をデコード・再エンコードしないため、サーバーでも切り抜いた形
（1MB 以下・一辺 800px 以下の正方形で、Exif・XMP・IPTC のセグメントを持たない JPEG）であることを
JPEG のマーカーから確かめ、スクリプトが動かなかった・切り抜きが終わる前に送られたなどで元のまま
届いた画像は断る（`src/catalog/image.ts`）。

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
`drizzle/`）が管理し、このパッケージは SELECT と、ユーザーの権限を変える UPDATE（`users` テーブルの
`role` 列）、ユーザーのセッションを削除する DELETE（`sessions` テーブル）、家のメンバーを追加・削除する
INSERT・DELETE（`household_members` テーブル）、
共通のごはん商品を登録・更新・削除する INSERT・UPDATE・DELETE（`catalog_food_products` テーブルと、
その画像の `media_assets` の行）だけを発行する。R2 は共通のごはん商品の画像の保存・削除だけに使う。

D1 の読み書きは、メインアプリの Drizzle スキーマ（リポジトリルートの `src/db/schema`。
`src/db/schema.ts` から再 export する）を使って Drizzle で行い、SQL を文字列で組み立てない
（値はすべてバインドパラメーターで渡す）。条件付きの INSERT はメインアプリの
`src/db/conditionalInsert.ts` の `insertWhere` を使う。どちらも `drizzle-orm` と相対パスだけを
import するため、Next.js 向けの tsconfig・パスエイリアスには依存しない。
メインアプリでテーブル・列を変更したときは、管理画面のクエリもスキーマに合わせて型が変わるので、
`pnpm --filter @canshi/admin typecheck`・`test` で確かめること。ごはん商品の入力の規則を変えたときは
`src/catalog/form.ts` も合わせて更新する。`src/db/queries.test.ts` などはリポジトリ
ルートの `drizzle/` のマイグレーションをすべて適用した DB（sql.js を D1 の形に包んだもの。
`src/test/d1.ts`）で実行するため、スキーマとマイグレーションの食い違いもテストで検出できる。

Drizzle の D1 ドライバーは、`batch` の結果を列名をキーにしたオブジェクトから並べ直すため、
同じ列名（`name` など）を持つテーブルを結合した SELECT を `batch` に入れると値を取り違える。
読み取りは `batch` に入れず、`Promise.all` で並べること。
