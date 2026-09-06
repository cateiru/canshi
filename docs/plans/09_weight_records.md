# 09. 体重記録機能

## 目的

猫の体重を、人間を含んだ体重からの自動算出、または直接入力のいずれかで記録できるようにする。

## スコープ

- 人間を含んだ体重と人間だけの体重を入力し、猫の体重を自動算出する入力モード
- 猫の体重を直接入力する入力モード
- 記録の一覧・編集・削除
- 体重の推移がタイムライン（`14`）で追えるよう、発生日時を伴って記録する

## 対象外

- 体重測定の通知提案（第2段階の通知機能、`16`）

## 依存 PR

- `03`（DB スキーマ基盤）
- `04`（デザインシステム）
- `05`（猫プロフィール）

## 変更・追加内容

- `weight_records` テーブル
- `src/app/cats/[catId]/weight-records/` 配下のページ
- `src/features/weight-records/`（自動算出ロジック）

## DB マイグレーション

- `weight_records` テーブルを新規作成
  - `id`、`cat_id`、`occurred_at`、`input_method`（自動算出／直接入力）、`combined_weight_kg`（nullable）、`human_weight_kg`（nullable）、`cat_weight_kg`、`created_at`、`updated_at`
  - `cat_weight_kg` は入力方法によらず最終的な猫の体重を保持する列とし、自動算出時は `combined_weight_kg - human_weight_kg` を保存時に計算する

## 受け入れ条件

- 自動算出モードで、人間込み体重と人間のみ体重から猫の体重が正しく計算される
- 直接入力モードでも記録できる
- 記録の一覧・編集・削除ができる
- 計算ロジックに Vitest の単体テストがある
