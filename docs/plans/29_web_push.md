# 29. Web Push 送信基盤

## 目的

`28` で生成された通知を Web Push で端末に届ける。Cloudflare Workflows のスケジュール実行で判定・送信を定期的に行う。

## スコープ

- Push 購読の管理
  - `push_subscriptions` テーブル
  - 購読の登録・解除を行う Server Action と、設定ページ（`src/app/settings/notifications/`）の「この端末で通知を受け取る」トグル。`31` の通知設定 UI はこのページに追記する
  - 通知の許可状態（`Notification.permission`）と PWA としての起動状態を確認し、iOS で Safari から開いている場合は「ホーム画面に追加してから有効化する」案内を表示する
- Service Worker（`27` の `public/sw.js`）への `push`・`notificationclick` ハンドラの追加
  - 通知のクリックで `notifications.url` を開く
- VAPID 鍵の管理
  - 公開鍵は `NEXT_PUBLIC_VAPID_PUBLIC_KEY`、秘密鍵は `VAPID_PRIVATE_KEY`（`wrangler secret`）。`.env.example` と `docs/deploy.md` に鍵の生成手順を追記する
- Web Push の送信処理
  - Workers で動作するよう、Node.js 依存の `web-push` パッケージは使わず、WebCrypto で RFC 8291（ペイロード暗号化）と RFC 8292（VAPID）を実装する（もしくは Workers 対応の軽量ライブラリを採用する。着手時に検証して決める）
  - `410 Gone`／`404` を返した購読は削除する。それ以外の失敗は `failure_count` を加算し、一定回数を超えたら削除する
- スケジュール実行
  - `wrangler.toml` の `[triggers] crons` で 15 分ごとに Worker の `scheduled` ハンドラを起動し、Workflow（`NotificationWorkflow`）のインスタンスを作成する
  - Workflow のステップ：`generateNotifications(now)` の実行 → `pushed_at` が NULL の未対応通知の取得 → 購読ごとの送信（ステップ単位でリトライ） → `pushed_at` の更新
  - OpenNext の生成物（`.open-next/worker.js`）をラップするカスタムエントリポイント（`src/worker.ts` 相当）を用意し、`fetch` はそのまま委譲しつつ `scheduled` と Workflow クラスを追加で export する。OpenNext でこの構成が成立することを着手時に検証する
- ローカル開発での動作確認手順（`wrangler dev --test-scheduled` による `scheduled` の手動起動）を `README.md` に記載

## 対象外

- 通知センター UI（`30`）。Web Push が使えない環境向けの表示は `30` で扱う
- 通知の種類ごとの設定 UI（`31`）
- メール等、Web Push 以外の送信手段

## 依存 PR

- `27`（PWA 対応。Service Worker）
- `28`（通知条件の判定ロジック）

## 変更・追加内容

- `src/db/schema/push-subscriptions.ts`
- `src/features/push/`（購読の登録・解除、送信処理、VAPID）
- `src/app/settings/notifications/page.tsx`
- `public/sw.js` の更新
- `src/worker.ts`（カスタムエントリポイント）と `src/workflows/notification.ts`
- `wrangler.toml`（`[triggers]`・`[[workflows]]`）、`open-next.config.ts`
- `.env.example`、`docs/deploy.md`、`README.md`

## DB マイグレーション

- `push_subscriptions` テーブルを新規作成
  - `id`、`endpoint`（UNIQUE）、`p256dh`、`auth`、`user_agent`（nullable）、`failure_count`、`created_at`、`last_used_at`

## 受け入れ条件

- 設定ページから端末の Push 購読を登録・解除できる
- スケジュール実行により、生成された通知が購読中の端末に届き、クリックで対象ページが開く
- 同じ通知が同じ端末に二重に送信されない
- 無効になった購読が自動で削除される
- 送信処理（暗号化・VAPID 署名）に Vitest の単体テストがある
- ローカル環境で `scheduled` を手動起動して一連の流れを確認できる
