# 12. 服薬記録機能

## 目的

服薬の予定と実績を記録し、関連する症状と紐付けられるようにする。

## スコープ

- 薬名、1 回量、1 日あたりの回数の記録
- 服用開始日、終了予定日の記録
- 実際に投薬した日時と投薬できたかどうかの記録（服薬予定に対する実績記録）
- 関連する症状記録への紐付け（本 PR で `symptom_id` 外部キーを追加）
- 記録の一覧・編集・削除

## 対象外

- 通院記録との紐付け（`13` で追加する）
- 処方箋・薬袋の写真の登録（第2段階）

## 依存 PR

- `03`（DB スキーマ基盤）
- `04`（デザインシステム）
- `05`（猫プロフィール）
- `11`（症状記録）

## 変更・追加内容

- `medications` テーブル（服薬の予定・マスタ的な情報）
- `medication_doses` テーブル（実際の投薬実績）
- `src/app/cats/[catId]/medications/` 配下のページ
- `src/features/medications/`

## DB マイグレーション

- `medications` テーブルを新規作成
  - `id`、`cat_id`、`symptom_id`（nullable）、`name`、`dose_amount`、`doses_per_day`、`start_date`、`end_date`（nullable）、`created_at`、`updated_at`
- `medication_doses` テーブルを新規作成
  - `id`、`cat_id`、`medication_id`、`occurred_at`（実際に投薬した日時）、`was_administered`（投薬できたかどうか）、`memo`、`created_at`、`updated_at`
  - `cat_id` は `medication_id` 経由でも解決できるが、`03` の規約（すべての記録テーブルが `cat_id` を持つ）を守り、`14` のタイムライン集約を他の記録テーブルと同じ形（`medications` への JOIN 不要）で書けるようにするために保持する
  - `hospital_visit_id`（nullable）は本 PR では追加せず、`13` のマイグレーションで追加する

## 受け入れ条件

- 服薬予定（薬名・用量・回数・期間）を登録・編集・削除できる
- 投薬実績（服用日時・投薬できたか）を記録できる
- 症状記録と紐付けて表示できる
