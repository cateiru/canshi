# デプロイ

CANSHI の Cloudflare 環境へのデプロイ手順・運用設定をまとめる。`docs/plans/` の実装計画には含めず、本ファイルに集約する。

## 前提

- ホスティング：Cloudflare Workers
- ビルド：`@opennextjs/cloudflare` で `next build` の出力を Workers 向けに変換する
- DB：Cloudflare D1
- オブジェクトストレージ：Cloudflare R2（写真・動画の本体は非公開バケットに保存）
- バックグラウンド処理：Cloudflare Workflows（定期通知のスケジュール実行）
- 外部アクセス制御：Cloudflare Access（プレビュー URL と管理画面。メインアプリの本番ドメインは
  Access で保護せず、アプリのログインで利用者を制限する）
- アプリ内のログイン・認可：Cloudflare Access の SaaS OIDC アプリでログインし、D1 に保存する
  ログインセッション（Cookie にはセッショントークンだけを保存）で認可する。
  ユーザーは所属する「家」の猫だけを参照できる。メールアドレス・パスワードでのログインは持たない

## 必要な Cloudflare リソース

- Workers（アプリ本体）
- Workers（管理画面、`packages/admin`）と、管理者だけを許可する Access の Self-hosted アプリケーション
- D1 データベース（本番・ステージング用に分離するかは要検討）
- R2 バケット
  - メディア（写真・動画）用バケット（非公開）
  - ISR・SSG のキャッシュ用バケット（メディア用とは分離する。`docs/idea/index.md` の方針）
- Cloudflare Workers 全体の Access 設定と許可ポリシー（プレビュー URL の保護に使う）
- Cloudflare Workflows（定期通知が実装される第2段階以降で必要）
- Workers KV（MCP の OAuth のクライアント登録・トークン用、バインディング名 `OAUTH_KV`）と
  Durable Objects（MCP のセッション用。「MCP サーバー」節）

## 環境変数・シークレット

`docs/plans/01_project_setup.md` で用意する `.env.example` を基準に、本番用の値を Cloudflare のシークレット管理（`wrangler secret put` 等）で設定する。

- D1・R2 のバインディング名（`wrangler.toml` で定義）
- ログイン（OIDC）の設定と、メールアドレスをハッシュにする SALT（「ログインと家」節の
  「ログイン（Cloudflare Access の OIDC）」を参照）
- OpenAI API キー（第3段階の AI 機能実装時に追加）

## デプロイ手順

- メインアプリは、Cloudflare 側の GitHub App（Workers Builds）で自動的にデプロイされる。
  `main` にマージされるとデプロイがトリガーされるため、手動で `wrangler deploy` する必要はない。
  GitHub Actions からはデプロイしない
- 本番 D1 のマイグレーションは自動では適用されない（Workers Builds のブランチプレビューも適用しない）。
  `pnpm db:migrate:remote`（`wrangler d1 migrations apply DB --remote`）を手動で実行したときだけ適用される
  - マージと同時に新しいコードがデプロイされるため、新しい列・テーブルを使うコードを含む PR では、
    マイグレーションの適用とマージの順序に注意する。列・テーブルを追加するだけのマイグレーションは、
    マージ前に適用しても旧バージョンのアプリはそのまま動く
  - 適用のタイミングは PR 本文に書く

未着手の検討事項:

- ステージング環境を用意するかどうか

## ログインと家（ユーザー・猫の紐付け）

ログインセッションは D1 の `sessions` テーブルで管理する。Cookie（`canshi-session`）にはランダムな
セッショントークンだけを保存し、DB にはそのハッシュを保存する（`src/features/auth/sessions.ts`）。
`src/middleware.ts` はリクエストごとに Cookie のトークンを D1 のセッションと照合し、有効なセッションが
なければ `/login` へリダイレクトする（API・メディアは 401）。
猫は「家」に所属し、ユーザーは所属する家の猫だけを参照できる（テーブル設計は
[`src/db/README.md`](../src/db/README.md) を参照）。

### ログイン（Cloudflare Access の OIDC）

`/login` のログインボタンは `/login/start` から Cloudflare Access の SaaS OIDC アプリへ
リダイレクトし、Access でログインすると `/login/callback` に戻る（認可コードフロー + PKCE、
`src/features/auth/oidc.ts`）。メールアドレス・パスワードでのログインは持たない。

- 要求するスコープは `openid email` だけで、ID トークンからはメールアドレスだけを使う
- DB にはメールアドレスそのものを保存しない。SALT（`EMAIL_HASH_SALT`）を使って argon2id で
  ハッシュにした値を `users.email_hash` に保存し、同じユーザーかどうかもこの値で判定する
  （`src/features/auth/emailHash.ts`）。ハッシュの計算に CPU を 200 ms 以上使うため、計算は
  ログイン時だけ行う（Workers の Paid プランが前提）
- 初めてログインしたメールアドレスでは、ユーザーを新しく作る（家には所属しない。家への招待 URL で
  参加する）。ユーザーが 1 件もないときに最初にログインしたユーザーは管理者になる
- **`EMAIL_HASH_SALT` は運用を始めたら変えない。** 変えると全員のハッシュが一致しなくなり、
  ログインすると別の新しいユーザーになる。ハッシュのパラメータ（`EMAIL_HASH_PARAMS`）も同じ

設定する値（いずれも `wrangler secret put` で設定する。`ACCESS_DISCOVERY_URL` は機密情報では
ないが、`wrangler.toml` の `[vars]` にない値はデプロイのたびに消えるため、シークレットにする）:

| 名前 | 内容 |
| --- | --- |
| `ACCESS_DISCOVERY_URL` | SaaS OIDC アプリの OIDC discovery URL（`.../.well-known/openid-configuration`） |
| `ACCESS_CLIENT_ID` | SaaS OIDC アプリの Client ID |
| `ACCESS_CLIENT_SECRET` | SaaS OIDC アプリの Client secret |
| `EMAIL_HASH_SALT` | メールアドレスのハッシュに使う SALT（16 文字以上。`openssl rand -hex 32` などで作る） |

```sh
wrangler secret put ACCESS_DISCOVERY_URL
wrangler secret put ACCESS_CLIENT_ID
wrangler secret put ACCESS_CLIENT_SECRET
wrangler secret put EMAIL_HASH_SALT
```

`ACCESS_*` のどれかが未設定の本番環境では、ログインボタンを押すとエラーになる（ログインせずに
使える状態にはならない）。

SaaS OIDC アプリの作成:

1. Zero Trust の Access controls > Applications で **SaaS** アプリケーションを追加し、
   認証プロトコルに **OIDC** を選ぶ。
2. Redirect URL に `https://canshi.cateiru.dev/login/callback` を登録する。スコープは `openid` と
   `email` だけにする。PKCE を有効にする。
3. メインアプリの利用者を許可するポリシーを付ける（Workers 全体の Access と同じポリシーでよい）。
   メインアプリの本番ドメインは Access で保護していないため、このポリシーが「誰が CANSHI を
   使えるか」を決める（「Cloudflare Access 設定」節）。
4. 表示された Client ID・Client secret・OIDC discovery URL を、上の手順でシークレットに設定する。

Redirect URL は登録したホスト名でしか使えないため、Workers Builds のプレビュー URL
ではログインできない（必要ならその URL も Redirect URL に追加する）。

ローカル開発（`next dev`）では、`ACCESS_*` が未設定なら `/login` が開発用のログイン（Access を
通さず、入力したメールアドレスでログインする）になる。e2e・VRT もこれを使う。`EMAIL_HASH_SALT` が
未設定なら開発用の SALT を使う（VRT の seed はこの SALT を前提にしている）。`.dev.vars` に
`ACCESS_*` を設定すれば、ローカルでも Access でのログインを確認できる（Redirect URL に
`http://localhost:3000/login/callback` を追加する）。開発用のログインは本番ビルドでは使えない
（`src/features/auth/developmentLogin.ts`）。

### OIDC でのログインの導入手順

OIDC でのログインの導入前（マイグレーション `0041` より前）から使っていたユーザーは、メールアドレスの
ハッシュを持たない。紐付けずにログインすると、同じ人でも別の新しいユーザー（家に未所属）が作られる。
また、導入前のセッションはすべてログインボタンで作られた同じユーザーのものなので、導入後に削除する。
次の順で導入する。

1. 上の手順で SaaS OIDC アプリを作り、4 つのシークレットを設定する。
2. `pnpm db:migrate:remote` で `0041` を適用する。列とインデックスを追加するだけなので、デプロイより
   前に適用しても旧バージョンのアプリはそのまま動く。
3. 既存のユーザーにメールアドレスを紐付ける。ユーザーの ID は管理画面のユーザー一覧で確かめる。
   SALT は手順 1 で設定した値と同じにする（違うとログインしても一致しない）。

        read -rs EMAIL_HASH_SALT && export EMAIL_HASH_SALT
        pnpm user:link-email --remote --user-id <ユーザー ID> --email <Access でログインするメールアドレス>

4. マージしてデプロイする。
5. 導入前のセッションをすべて削除する。全員がログアウトし、次のログインから Access でログインする。

        pnpm exec wrangler d1 execute DB --remote --command "DELETE FROM sessions"


手順 3 より先にログインしてしまうと、そのメールアドレスで新しいユーザー（家に未所属）が作られ、
手順 3 のスクリプトは「すでに別のユーザーに紐付いています」で止まる。その場合は、作られたユーザーの
セッションと行を削除してから手順 3 をやり直す（新しいユーザーは家に所属しておらず、記録も持たない）。

    pnpm exec wrangler d1 execute DB --remote --command "DELETE FROM sessions WHERE user_id = '<新しいユーザーの ID>'; DELETE FROM users WHERE id = '<新しいユーザーの ID>'"

### セッションの有効期限とログアウト

- セッションの有効期限はログインから 30 日で、延長しない。期限が切れたら再度ログインする
- ログアウトするとセッションを D1 から削除するため、ログアウト前の Cookie を使い回してもログインできない
- 利用者は設定の「アカウント設定」から、自分のセッションをすべて削除できる（すべての端末からログアウト）
- 利用者は「アカウント設定」の「ログイン中の端末」で、ログインしている端末（ログイン時の User-Agent から
  変換した端末名とログイン日時）を確認し、端末を指定してログアウトさせられる
- 特定のユーザーを強制的にログアウトさせるときは、管理画面のユーザー一覧の「すべての端末からログアウト」を
  使う（`sessions` テーブルからそのユーザーの行をすべて削除する）
- セッションを削除しても、MCP コネクタ（ChatGPT など）の接続は解除されない。MCP サーバーの OAuth の
  認可はセッションとは別に（`OAUTH_KV`）保存している（「MCP サーバー」節）

### 導入時の手順（既存の猫の紐付け）

家の導入（マイグレーション `0036`）より前から登録されていた猫は、どの家にも所属しないため
アプリに表示されない。マイグレーションでユーザー・家を自動で作らないため、次の順で導入し、
デプロイ後に既存の猫を紐付ける。

1. `pnpm db:migrate:remote` でマイグレーションを適用し、メインアプリをデプロイする。マイグレーションは
   テーブルと列を追加するだけなので、先に適用しても旧バージョンのアプリはそのまま動く。逆に
   マイグレーションより先にデプロイすると、`sessions` テーブルがないためログインできない。
2. `/login` を開いてログインする。ユーザーが 1 件もなければ、管理者ユーザーが作られる。
3. `pnpm household:link --remote` を実行する。最初に登録されたユーザー（`--user-id` または
   `--email` で指定もできる）をオーナーとする家を作り
   （名前は `--name` で指定、既定は「わが家」）、家に未所属の猫をすべてその家に紐付ける。
   ユーザーがすでに家に所属している場合は、その家に紐付ける。家に未所属の支出記録（マイグレーション
   `0039` で家を決められなかったもの）と、家に未所属のごはん商品・ごはんプリセット（マイグレーション
   `0040` より前に登録したもの）も同じ家に紐付ける。ユーザーに紐付いていない Web Push の
   購読（導入前に登録したもの）も、同じユーザーに紐付ける。何度実行しても結果は変わらない。

ローカル開発の DB では `pnpm household:link --local --persist-to ./.wrangler/state` を実行する。

- 猫を新しく登録すると、ログイン中のユーザーの家に所属する。家に所属していないユーザーは猫を
  登録できない
- MCP のトークンには、同意したときにログインしていた CANSHI のユーザー ID を保存する
  （「MCP サーバー」節）

## R2 バケット（メディア）

写真・動画の本体とサムネイルは `wrangler.toml` の `[[r2_buckets]]`（バインディング名 `MEDIA_BUCKET`、バケット名 `canshi-media`）に保存する。ローカル開発では Miniflare が `.wrangler/state` 配下にエミュレートするため、バケットの作成は不要。

### 本番バケットの作成

```sh
wrangler r2 bucket create canshi-media
```

- バケットは非公開のまま運用する（パブリックアクセス・カスタムドメインは設定しない）。配信はアプリの `GET /media/[assetId]` 経由で行い、ログインセッションで保護する（猫に紐付くメディアは、その猫の家のユーザーだけが取得できる）
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

Cloudflare ダッシュボードの Workers & Pages で、Workers 全体を保護する設定を `All traffic` として設定済み（2026-09 時点）。この設定により、既存・新規 Worker の本番 URL とプレビュー URL へのリクエストは、Worker が実行される前に Access で評価される。

メインアプリ（Worker 名 `canshi`）は、Worker 単位の設定で本番のカスタムドメイン（`canshi.cateiru.dev`）だけを Access の対象から外している（2026-10 時点）。本番ドメインでの利用者の制限は、アプリのログイン（Access の SaaS OIDC アプリ。「ログインと家」節を参照）で行う。

- `src/middleware.ts` が、`src/features/auth/publicPaths.ts` に挙げたパス（`/login`、PWA の manifest・アイコンなど）以外のすべてのリクエストで、D1 のログインセッションを確認する
- ログインできるのは、SaaS OIDC アプリのポリシーで許可された人だけになる。初めてログインしたメールアドレスではユーザーが作られるため、このポリシーが「誰が CANSHI を使えるか」を決める
- プレビュー URL は、引き続き Workers 全体の Access で保護する。プレビュービルドは本番と同じ D1・R2 に接続するため、レビュー前のコードを本番データ付きで公開しないためである
- `workers.dev` は無効にしている

アプリケーション内で `Cf-Access-Jwt-Assertion` を検証する処理や、そのための Team ドメイン・Audience タグの環境変数は持たない。

### 設定の確認

1. Cloudflare ダッシュボードの Workers & Pages を開く。
2. Overview の **Protect all Workers** で、保護対象が **All traffic** になっていることを確認する。
3. Workers 全体の Access に適用されているポリシーが、意図したユーザーまたはグループだけを許可していることを確認する。
4. Workers & Pages から CANSHI の Worker を開き、Access の対象から外しているのが本番のカスタムドメインだけであること、プレビュー URL が保護されていること、`workers.dev` が無効であることを確認する。
5. Zero Trust の Access controls > Applications で、CANSHI のホスト名・パスに対する、意図しない公開設定や Bypass ポリシーがないことを確認する。
6. メインアプリの SaaS OIDC アプリのポリシーが、メインアプリの利用者だけを許可していることを確認する。

Access の設定は、ホスト名・パス単位、Worker 単位、Workers 全体の順に具体的なものが優先される。Workers 全体を保護していても、より具体的な設定で公開するとその経路が保護されないため、設定変更時は手順 4・5 も確認する。

### 許可ユーザーの追加・削除

1. Zero Trust の Access controls > Policies を開く。
2. メインアプリの SaaS OIDC アプリに適用しているポリシーを開く。Workers 全体の Access と同じ再利用可能なポリシーを使っている場合は、プレビュー URL の許可対象も同時に変わる。
3. Include ルールのメールアドレスまたはグループを更新して保存する。
4. 利用者を削除したときは、管理画面（`canshi-admin.cateiru.dev`）でそのユーザーを「すべての端末からログアウト」させる。ポリシーから外しても、ログイン済みのセッションは有効期限まで使えるためである。
5. 次の動作確認を実施する。

許可対象の具体的なメールアドレスやグループは機密性のある運用情報として扱い、リポジトリには記載しない。

### 動作確認

- ログアウト状態で本番のカスタムドメインを開き、Access の画面ではなく CANSHI のログイン画面（`/login`）が表示されることを確認する
- 許可対象外のアカウントで `/login` からログインし、Access の拒否画面が表示されてログインできないことを確認する
- ログアウト状態または許可対象外のアカウントでプレビュー URL を開き、Access のログイン画面または拒否画面が表示されることを確認する
- 許可対象のアカウントでログインし、CANSHI を利用できることを確認する
- Worker や公開経路を追加したとき、および Access ポリシーを変更したときは再確認する

詳細は [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) と [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) を参照する。

## Web Push（VAPID 鍵）

`29` の Web Push 送信（`src/features/push/`）に使う VAPID 鍵ペアは、デプロイ環境ごとに1回生成する。

```sh
pnpm vapid:generate
```

出力される2つの値の扱いが異なる点に注意する。

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`：クライアント（`PushSubscriptionToggle`）に埋め込まれるため、**ビルド時**に読める場所（`pnpm cf:build` を実行する環境の `.env.production.local` や CI の環境変数）に設定する必要がある。あわせて実行時（`src/workflows/notification.ts` が Push 送信に使う）にも必要なので、`wrangler secret put` でも設定する
- `VAPID_PRIVATE_KEY`：サーバー側だけで使う秘密鍵。`wrangler secret put` で設定する（クライアントに公開してはいけない）
- `VAPID_SUBJECT`：RFC 8292 が要求する連絡先（`mailto:` の管理者アドレスなど）。`wrangler secret put` で設定する

```sh
wrangler secret put NEXT_PUBLIC_VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT
```

いずれかが未設定の環境では、通知の生成（`28`）は動作するが Push 送信は自動的にスキップされる（`getVapidKeys` が `null` を返す）。

ローカル開発では `.dev.vars`（Git 管理対象外）に同じ3つを設定する。`NEXT_PUBLIC_VAPID_PUBLIC_KEY` は `next dev`／`next build` のビルド時読み込み用に `.env` にも追記する（`.env.example` 参照）。

### エントリポイントと定期実行

`wrangler.toml` の `main` は `.open-next/worker.js` を直接ではなく、それをラップするカスタムエントリポイント `worker.ts`（リポジトリルート）を指す。`worker.ts` は OpenNext の `fetch` ハンドラに加えて `scheduled`（`[triggers] crons`、15分ごと）と `NotificationWorkflow`（`[[workflows]]`）を export する。デプロイ後、cron トリガーが実際に有効になるまで最大15分のグローバル伝播遅延がある。

ローカルでの動作確認手順は [`README.md`](../README.md#web-push通知) を参照。

## MCP サーバー（外部 AI エージェント連携）

`docs/plans/32_mcp_oidc_overview.md` の方針に基づき、ChatGPT などの外部 AI エージェントが
CANSHI のデータを参照できる MCP サーバーを、メインアプリの Worker の `/mcp` で公開している
（`src/features/mcp/`）。コネクタに登録する URL は `https://canshi.cateiru.dev/mcp`。
認可サーバーの実装は `@cloudflare/workers-oauth-provider` で、ログインはメインアプリの
ログイン（セッション）をそのまま使う。

- `src/worker.ts` が OpenNext のハンドラを `OAuthProvider` で包む。`/mcp`（アクセストークンで
  保護）・`/oauth/token`・`/oauth/register`（DCR）・`/.well-known/oauth-*` は Next.js に渡さずに
  処理する
- `/oauth/authorize` は同意画面。Worker が認可リクエストを検証してから Next.js のページ
  （`src/app/oauth/authorize/page.tsx`）を表示する。未ログインならログイン画面へ送り、ログイン後に
  同意画面へ戻る。「許可する」を押すと、ログイン中のユーザーの ID をトークンに保存して認可を完了する
  （`src/features/mcp/authorize.ts`）。DCR は誰でも呼べるため、一度許可したクライアントでも
  毎回同意画面を表示する
- MCP のツールは、トークンに保存したユーザーの家の猫だけを返す
- `OAUTH_KV`（`@cloudflare/workers-oauth-provider` の標準ストレージ）に、クライアント登録・
  認可コード・トークンを保存する。KV Namespace の id は `wrangler.toml` の `[[kv_namespaces]]` に
  設定する
- MCP のセッション状態は Durable Object（`CanshiMcp`、バインディング名 `MCP_OBJECT`）に保存する。
  Durable Object のマイグレーション（`wrangler.toml` の `[[migrations]]`）は `wrangler deploy`
  でだけ適用され、Workers Builds のブランチプレビュー（`wrangler versions upload`）では
  適用できない。新しいマイグレーションを含む PR のプレビューのビルドは失敗するが、
  マージ後の本番デプロイで適用される
- メインアプリの本番ドメインは Access で保護していないため、`/mcp` などには Access のログイン画面を
  挟まずに到達できる。プレビュー URL は Access で保護しているため、プレビューでは MCP を使えない

`next dev` は `src/worker.ts` を通らないため、`/mcp` と同意画面は使えない。ローカルで確認するときは
`pnpm cf:preview` で起動する。

以前は別の Worker（`packages/mcp-server`、Worker 名 `canshi-mcp`、`mcp.canshi.cateiru.dev`）で
動かし、Cloudflare Access の SaaS OIDC アプリでログインしていた。メインアプリへ移したあとは
使わないため、Worker（とカスタムドメイン）を削除し、そのとき作った MCP 用の SaaS OIDC アプリと
`mcp.canshi.cateiru.dev/callback` の Redirect URL も不要になる。コネクタは新しい URL で接続し直す。

### トラブルシューティング

#### ChatGPT からの接続だけ `Dynamic client registration failed: registration endpoint returned 403` になる

`POST /register`（DCR）を curl 等で直接叩くと成功するのに、ChatGPT のカスタム
コネクタから接続しようとすると DCR が `403` で失敗する場合、**Cloudflare の
Bot Fight Mode が ChatGPT からのリクエストをブロックしている**可能性が高い。

- `@cloudflare/workers-oauth-provider` のコードには DCR 失敗時に `403` を返す
  経路が存在しない（バリデーションエラーは `400` 系）ため、アプリケーション側の
  問題ではなく Cloudflare のエッジで止められている、という切り分けができる
- 同種の事例（[solectrus/solectrus の MCP.md](https://github.com/solectrus/solectrus/blob/develop/docs/MCP.md#troubleshooting)）でも、Claude は通るが ChatGPT だけ弾かれる、
  という同じ症状が報告されている
- **無料プランの Bot Fight Mode はパス単位で除外できない**ため、対処は以下のいずれか
  - **Free プラン**: ゾーン全体で Bot Fight Mode をオフにする
    （Cloudflare ダッシュボード → 対象ゾーン → Security → Bots）。
    CANSHI の本番（`cateiru.dev` ゾーン）はこの方法で解決した
  - **Pro プラン以上**: Super Bot Fight Mode に切り替え、
    `/mcp`・`/oauth/*`・`/.well-known/oauth*` にスキップルールを追加する

## 管理画面

運用者向けの管理画面を、メインアプリとは別の Cloudflare Workers（`packages/admin/`、Worker 名
`canshi-admin`）として用意している。公開ホスト名は `canshi-admin.cateiru.dev`
（`packages/admin/wrangler.jsonc` の `routes` で `custom_domain` として設定。`workers.dev`・
プレビュー URL は作らない）。メインアプリと同じ D1（`canshi-db`）を直接参照し、ユーザー・家の
一覧を閲覧できる。書き換えるデータは、ユーザーをすべての端末からログアウトさせる操作で削除する
ログインセッション（`sessions` テーブル）だけ。

アクセス制御は Cloudflare Access に任せ、アプリ内では認証しない。管理画面は家ごとの絞り込みを
せず全ユーザー・全家の情報を表示するため、メインアプリの利用者（家族など）を含む Workers 全体の
Access のポリシーではなく、**管理者だけを許可する専用のポリシー**で保護する。

`canshi-admin.cateiru.dev` の Self-hosted アプリケーションを作れば、Workers 全体の Access より
具体的な設定として優先される（「Cloudflare Access 設定」節）。また、以前の MCP サーバーの
カスタムドメイン（`mcp.canshi.cateiru.dev`）には Workers 全体の Access が適用されなかったため、
Workers 全体の Access だけには頼れない。Self-hosted アプリケーションは
**デプロイする前に**作る（デプロイしてから作ると、それまでの間に一覧が誰にでも見えてしまう）。

### 初回の公開手順

1. Zero Trust の Access controls > Policies で、管理者（運用者）だけを Include するポリシーを作る。
   Workers 全体の Access に適用している、メインアプリの利用者全員を許可するポリシーは使わない。
2. Access controls > Applications で **Self-hosted** アプリケーションを追加し、ドメインに
   `canshi-admin.cateiru.dev` を指定して、1. のポリシーだけを付ける。
3. `pnpm --filter @canshi/admin deploy` でデプロイする（カスタムドメインも作成される）。
4. すぐに次の動作確認を実施する。

### 動作確認

- ログアウト状態で `https://canshi-admin.cateiru.dev/` を開き、Access のログイン画面が表示される
  ことを確認する（一覧が表示されたら、直ちに Worker を削除する）
- 管理者ではないメインアプリの利用者のアカウントで認証し、拒否されることを確認する
- 管理者のアカウントで認証し、ユーザー・家の一覧を閲覧できることを確認する
- Access のポリシーやアプリケーションを変更したときは再確認する

管理画面のコードはマイグレーションを持たない。メインアプリのマイグレーションで列名を変えたときは、
管理画面も合わせて更新・デプロイする（`packages/admin/src/db/queries.ts`）。

## 監視・運用（TODO）

- エラー監視・ログの方針
- D1・R2 の利用量・コストの監視
- バックアップ方針（D1・R2）

## 備考

本ファイルは実装の進行に合わせて更新する。各 TODO は該当する実装 PR（`docs/plans/`）に着手する前に内容を確定させること。
