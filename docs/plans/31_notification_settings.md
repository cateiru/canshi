# 31. 通知設定 UI

## 目的

通知時刻・タイムゾーンと、猫ごと・種類ごとの通知の有効／無効やパラメータを画面から設定できるようにする。

## スコープ

- 全体設定（`src/app/settings/notifications/`。`29` のページに追記する）
  - 通知時刻（`notify_time`）とタイムゾーン（`timezone`）の設定。タイムゾーンは IANA 名の選択式とし、初期値は端末のタイムゾーンを提案する
- 猫ごとの通知設定（`src/app/cats/[catId]/notification-settings/`）
  - 誕生日（年ごと・半年ごと・100 日ごと）の有効／無効
  - シャンプー経過通知の有効／無効と月数
  - 体重測定の提案の有効／無効と日数
  - 掃除対象ごとの通知の有効／無効（`26` の掃除対象一覧から遷移できるようにする）
- 猫詳細ページから通知設定への導線
- 設定変更後に、次回のスケジュール実行から新しい設定が反映されること（`28` の判定は設定を都度読むため、キャッシュを持たない）
- E2E テスト（Playwright）：通知設定の変更を検証する（`docs/idea/index.md` の E2E 対象「通知設定」に対応）

## 対象外

- 通知の送信先端末の管理（`29` の購読トグルで扱う）
- 通知ごとの個別のミュート（`30` の無視で代替する）

## 依存 PR

- `28`（通知条件の判定ロジック）
- `29`（Web Push 送信基盤。設定ページの土台）
- `30`（通知センター UI）

## 変更・追加内容

- `src/app/settings/notifications/page.tsx` の更新
- `src/app/cats/[catId]/notification-settings/page.tsx`
- `src/features/notifications/NotificationPreferencesForm.tsx`、`NotificationSettingsForm.tsx`
- `src/features/notifications/settingsActions.ts`、`settingsQueries.ts`
- `src/features/cats/recordNav.ts` もしくは猫詳細ページへの導線の追加
- `e2e/notification-settings.spec.ts`

## DB マイグレーション

なし（`28` のテーブルを利用）

## 受け入れ条件

- 通知時刻とタイムゾーンを変更でき、次回の判定に反映される
- 猫ごとに 6 種類の通知の有効／無効と、シャンプーの月数・体重測定の日数を設定できる
- 掃除対象ごとに通知の有効／無効を設定できる
- E2E テストで通知設定の変更が検証される
