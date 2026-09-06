# 10. 嘔吐記録機能

## 目的

嘔吐の記録を残し、健康状態の把握に役立てる。

## スコープ

- 発生日時、回数、量、色の記録
- 血液や異物の有無、備考、食欲・元気の記録
- 記録の一覧・編集・削除

## 対象外

- 写真の登録・AI による補助分類（`media_assets`・`ai_evaluations` は `record_type`/`record_id` でこのテーブルの行を参照できるが、書き込み UI は第2・第3段階で実装する）

## 依存 PR

- `03`（DB スキーマ基盤）
- `04`（デザインシステム）
- `05`（猫プロフィール）

## 変更・追加内容

- `vomit_records` テーブル
- `src/app/cats/[catId]/vomit-records/` 配下のページ
- `src/features/vomit-records/`

## DB マイグレーション

- `vomit_records` テーブルを新規作成
  - `id`、`cat_id`、`occurred_at`、`count`、`amount`、`color`、`has_blood`、`has_foreign_object`、`appetite_note`、`energy_note`、`memo`、`created_at`、`updated_at`

## 受け入れ条件

- 嘔吐記録の登録・編集・削除・一覧ができる
- 血液・異物の有無がフラグとして記録・表示される
