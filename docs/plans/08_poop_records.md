# 08. うんち記録機能

## 目的

うんちの記録を残し、健康状態の把握に役立てる。

## スコープ

- 発生日時、回数、量、色の記録
- 状態の記録（硬い、ふつう、柔らかい、液体）
- 血液や異物の有無、備考、食欲・元気の記録
- 記録の一覧・編集・削除

## 対象外

- 写真の登録・AI による補助分類（`media_assets`・`ai_evaluations` は `record_type`/`record_id` でこのテーブルの行を参照できるが、書き込み UI は第2・第3段階で実装する）

## 依存 PR

- `03`（DB スキーマ基盤）
- `04`（デザインシステム）
- `05`（猫プロフィール）

## 変更・追加内容

- `poop_records` テーブル
- `src/app/cats/[catId]/poop-records/` 配下のページ
- `src/features/poop-records/`

## DB マイグレーション

- `poop_records` テーブルを新規作成
  - `id`、`cat_id`、`occurred_at`、`count`、`amount`、`color`、`consistency`（硬い／ふつう／柔らかい／液体）、`has_blood`、`has_foreign_object`、`appetite_note`、`energy_note`、`memo`、`created_at`、`updated_at`

## 受け入れ条件

- うんち記録の登録・編集・削除・一覧ができる
- 状態（硬さ）が選択式で入力できる
- 血液・異物の有無がフラグとして記録・表示される
- MVP で最初の「記録入力」の E2E テスト（Playwright）を追加し、うんち記録の登録から一覧表示までの一連の操作を検証する（`docs/idea/index.md` の E2E 対象「記録入力」に対応する最初のシナリオ）
