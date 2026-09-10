# 30. 通知センター UI

## 目的

生成された通知を一覧で確認し、完了・延期・無視を操作できる通知センターを実装する。Web Push を利用できない環境でも通知を受け取れる手段とする。

## スコープ

- 通知センターページ（`src/app/notifications/`）
  - 未対応（`pending`・延期到来済み）と対応済み（`done`・`dismissed`）のタブ表示（`04` の `Tabs` を利用）
  - 猫での絞り込み
  - 各通知の完了・延期（1 日／3 日／1 週間）・無視の操作
  - 通知から対象ページ（`notifications.url`）への遷移
- 既読管理
  - 通知センターを開いた時点で表示中の未対応通知を既読（`read_at`）にする
- ヘッダーの通知アイコンと未読件数バッジ（全ページ共通のレイアウトに追加）
- 通知センターを開いた際に `generateNotifications(now)` を実行し、スケジュール実行（`29`）を待たずに最新の通知を表示する
- E2E テスト（Playwright）：通知の完了・延期の操作を検証する

## 対象外

- 通知の種類ごとの設定 UI（`31`）
- Web Push の送信（`29`）

## 依存 PR

- `04`（デザインシステム）
- `28`（通知条件の判定ロジック）

## 変更・追加内容

- `src/app/notifications/page.tsx`
- `src/features/notifications/NotificationList.tsx`、`NotificationActions.tsx`、`NotificationBadge.tsx`
- `src/app/layout.tsx`（ヘッダーへのバッジ追加）
- `e2e/notification-center.spec.ts`

## DB マイグレーション

なし（`28` のテーブルを利用）

## 受け入れ条件

- 未対応・対応済みの通知が一覧表示され、猫で絞り込める
- 完了・延期・無視の操作ができ、延期した通知は期日到来後に再び未対応に表示される
- ヘッダーのバッジに未読件数が表示され、通知センターを開くと既読になる
- Web Push を購読していない環境でも通知センターで通知を確認できる
