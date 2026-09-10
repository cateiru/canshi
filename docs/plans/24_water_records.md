# 24. 水の記録機能

## 目的

飲水の記録を残し、給水量と残量から推定飲水量を算出して飲水量の変化を把握できるようにする。

## スコープ

- 発生日時、測定方法、給水量（ml）、残量（ml）の記録
- こぼれの有無、水交換の有無の記録
- 推定飲水量 = 給水量 − 残量 の自動計算
  - 残量が未入力の場合は計算しない
  - こぼれありの場合も計算はするが、一覧で「こぼれあり」を併記して参考値であることを示す
- 主観評価（多い・いつも通り・少ない）の記録
- 備考の記録
- 記録の一覧・編集・削除
- 猫詳細ページの記録導線（`RECORD_NAV_ITEMS`）への追加
- タイムライン（`14`）への追加（`03` の発生日時列の対応表に `water_records.occurred_at` を追加する）

## 対象外

- 自動給水器との連携
- 飲水量の推奨値との比較・警告

## 依存 PR

- `03`（DB スキーマ基盤）
- `04`（デザインシステム）
- `05`（猫プロフィール）
- `14`（タイムライン）

## 変更・追加内容

- `water_records` テーブル
- `src/app/cats/[catId]/water-records/` 配下のページ
- `src/features/water-records/`（推定飲水量の計算ロジック）
- `src/features/cats/recordNav.ts`・`src/features/timeline/` の更新
- `src/db/README.md` の発生日時列の対応表の更新

## DB マイグレーション

- `water_records` テーブルを新規作成
  - `id`、`cat_id`、`occurred_at`、`measurement_method`（計量カップ／秤／目視。`measuring_cup`／`scale`／`visual`）、`supplied_amount_ml`、`remaining_amount_ml`（nullable）、`estimated_intake_ml`（nullable）、`has_spill`、`was_water_changed`、`subjective_amount`（`more`／`usual`／`less`、nullable）、`memo`、`created_at`、`updated_at`
  - `estimated_intake_ml` は `07` の給餌記録と同様に保存時に計算した値を保持する

## 受け入れ条件

- 水の記録の登録・編集・削除・一覧ができる
- 給水量と残量から推定飲水量が正しく計算・表示される
- こぼれ・水交換の有無と主観評価が記録・表示される
- タイムラインに水の記録が表示され、種類で絞り込める
- 計算ロジックに Vitest の単体テストがある
