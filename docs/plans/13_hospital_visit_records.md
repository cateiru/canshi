# 13. 通院記録機能

## 目的

通院の予約・受診内容を記録し、症状・服薬記録との相互参照を完成させる。

## スコープ

- 予約日時、受診日時、受診理由の記録
- 診断・所見、検査と結果、注射・処置の記録
- 処方された薬を服薬記録（`12`）に紐付け
- 次回受診予定の記録
- 関連する症状の紐付け
- 記録の一覧・編集・削除
- `symptoms` テーブルと `medications` テーブル（または `medication_doses`）に、通院記録への外部キー（nullable）を追加するマイグレーション

## 対象外

- 診療明細などの画像の登録（第2段階）

## 依存 PR

- `03`（DB スキーマ基盤）
- `04`（デザインシステム）
- `05`（猫プロフィール）
- `11`（症状記録）
- `12`（服薬記録）

## 変更・追加内容

- `hospital_visits` テーブル
- `symptoms`・`medications` テーブルへの外部キー追加マイグレーション
- `src/app/cats/[catId]/hospital-visits/` 配下のページ
- `src/features/hospital-visits/`

## DB マイグレーション

- `hospital_visits` テーブルを新規作成
  - `id`、`cat_id`、`symptom_id`（nullable）、`reserved_at`（nullable）、`visited_at`、`reason`、`diagnosis`、`examination_results`、`treatment`、`next_visit_at`（nullable）、`memo`、`created_at`、`updated_at`
- `symptoms` テーブルに `hospital_visit_id`（nullable）を追加
- `medications` テーブルに `hospital_visit_id`（nullable）を追加

## 受け入れ条件

- 通院記録の登録・編集・削除・一覧ができる
- 通院記録から関連する症状・処方薬を参照できる
- 症状記録・服薬記録の画面からも、紐付いた通院記録を参照できる
