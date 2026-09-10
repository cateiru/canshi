# 28. 通知条件の判定ロジック

## 目的

誕生日・月齢・年齢の節目、シャンプー経過月数、体重測定の提案、掃除タイミングの通知を生成する判定ロジックと、通知を保持するテーブルを実装する。送信手段（Web Push、通知センター）には依存しない純粋なロジックとして切り出し、`29`〜`31` の土台にする。

## スコープ

- 通知の種類（`kind`）と判定ルール
  - `birthday_yearly`：誕生日（`cats.birth_date`）の年ごとの節目
  - `birthday_half_year`：生後 6 か月ごとの節目（誕生日と重なる年ごとの節目は `birthday_yearly` に統合し、二重に生成しない）
  - `days_milestone`：生後 100 日ごとの節目
  - `shampoo_elapsed`：前回のシャンプー（`25`）から設定した月数が経過
  - `weight_measurement`：前回の体重記録（`09`）から設定した日数が経過
  - `cleaning_due`：掃除対象（`26`）の次回予定日を迎えた
- 通知設定テーブルの追加と既定値
  - `notification_preferences`：通知時刻とタイムゾーン（全体で 1 行。既定値は 09:00・`Asia/Tokyo`）
  - `notification_settings`：猫ごと・種類ごとの有効／無効とパラメータ。行が無い場合は既定値（すべて有効、シャンプー 2 か月、体重測定 14 日）として扱う
- 判定関数 `evaluateNotificationRules({ now, timezone, cat, settings, latestShampooAt, latestWeightAt, cleaningTargets })`
  - 入力から「今日発火すべき通知の候補」を返す純粋関数。DB アクセスを持たない
  - 各候補は重複防止キー `dedupe_key`（例：`{catId}:birthday_yearly:{年齢}`、`{catId}:cleaning_due:{targetId}:{予定日}`）を持つ
  - 日付判定はすべて `notification_preferences.timezone` のローカル日付で行う
- 生成処理 `generateNotifications(now)`
  - 全猫について判定関数を実行し、`dedupe_key` が未登録の候補だけを `notifications` テーブルに INSERT する（`dedupe_key` は UNIQUE 制約で二重生成を防ぐ）
  - 通知時刻（`notification_preferences.notify_time`）を過ぎるまでは生成しない
  - `29` のスケジュール実行と `30` の通知センター表示の両方から呼べるようにする
- 通知の状態遷移
  - `pending`（未対応）→ `done`（完了）／`snoozed`（延期。`snoozed_until` を持ち、到来後は再び `pending` 扱い）／`dismissed`（無視）
  - `read_at` による既読管理
- 通知文言の生成（種類ごとのタイトル・本文・遷移先 URL）

## 対象外

- Web Push の送信（`29`）
- 通知センター UI・通知設定 UI（`30`・`31`）
- 記録の作成時に即時発火する通知（すべてスケジュール判定で扱う）

## 依存 PR

- `05`（猫プロフィール。誕生日）
- `09`（体重記録）
- `25`（シャンプー記録）
- `26`（掃除記録）

## 変更・追加内容

- `src/db/schema/notifications.ts`、`notification-settings.ts`、`notification-preferences.ts`
- `src/features/notifications/rules/`（種類ごとの判定関数と `evaluateNotificationRules`）
- `src/features/notifications/generate.ts`（`generateNotifications`）
- `src/features/notifications/messages.ts`（通知文言）
- `src/features/notifications/queries.ts`、`actions.ts`（状態遷移）
- `src/db/README.md` への通知テーブルの節の追加（`cat_id` を持つが記録テーブルではなく、タイムラインの対象外であることを明記）

## DB マイグレーション

- `notification_preferences` テーブルを新規作成
  - `id`（固定値 `"default"`）、`notify_time`（`HH:MM`）、`timezone`（IANA タイムゾーン名）、`created_at`、`updated_at`
- `notification_settings` テーブルを新規作成
  - `id`、`cat_id`、`kind`、`reference_id`（nullable。`cleaning_due` の場合は `cleaning_targets.id`）、`is_enabled`、`params`（JSON、nullable。シャンプーの月数・体重測定の日数）、`created_at`、`updated_at`
  - `(cat_id, kind, reference_id)` に UNIQUE 制約
- `notifications` テーブルを新規作成
  - `id`、`cat_id`、`kind`、`reference_id`（nullable）、`dedupe_key`（UNIQUE）、`title`、`body`、`url`、`due_at`、`status`（`pending`／`done`／`snoozed`／`dismissed`）、`snoozed_until`（nullable）、`read_at`（nullable）、`pushed_at`（nullable。`29` で使用）、`created_at`、`updated_at`
  - `(status, due_at)` にインデックス

## 受け入れ条件

- 6 種類の通知それぞれについて、発火する日・しない日・タイムゾーン境界のケースが Vitest の単体テストで検証されている
- 同じ日に `generateNotifications` を複数回実行しても通知が二重に作られない
- 通知設定で無効にした種類は生成されない
- 延期した通知が `snoozed_until` の到来後に未対応として扱われる
- 猫を削除すると、その猫の通知・通知設定も削除される
