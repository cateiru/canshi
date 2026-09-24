-- ビジュアルリグレッションテスト (Chromatic) 用の固定フィクスチャデータ。
-- `pnpm db:migrate:local` 直後のローカル D1、および CI の vrt ジョブに適用する
-- (README.md / .github/workflows/ci.yml 参照)。
--
-- 猫は2匹だけ用意する。
-- - vrt-cat-empty     : どの記録も一切登録しない（各記録一覧の「何もないケース」用）
-- - vrt-cat-populated : 各記録種別を1件ずつ登録する（「データがあるケース」用）。
--   掃除記録・服薬予定はネストした一覧ページの「データがある/何もない」の両方を
--   このデータだけで再現するため、対象/服薬予定をそれぞれ2件（1件は記録なし）にする。
--
-- 日時はすべて実行日時に依存しない固定値 (2024-06) にする。VRT の対象ページは
-- 「今日」からの相対計算をしないもの（占める割合の大半）に限定しているため、
-- 固定値であればスナップショットは実行日に関わらず安定する
-- (e2e/vrt.spec.ts のコメントで対象外にしているページを参照)。

INSERT INTO cats (id, name, sex, birth_date, breed, adopted_at, created_at, updated_at)
VALUES ('vrt-cat-empty', 'VRT空猫', 'unknown', NULL, NULL, NULL,
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO cats (id, name, sex, birth_date, breed, adopted_at, created_at, updated_at)
VALUES ('vrt-cat-populated', 'VRTテスト猫', 'female', '2015-04-01', '雑種', '2015-06-01',
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO food_products (id, name, kcal_per_100g, package_amount_g, nutrition_type, texture_type, created_at, updated_at)
VALUES ('vrt-food-1', 'VRTテストフード', 350, 1000, 'complete', 'dry',
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

-- 掃除記録: target-1 は記録あり、target-2 は記録なし（ネストした一覧の両ケースに使う）
INSERT INTO cleaning_targets (id, cat_id, name, frequency_value, frequency_unit, is_active, sort_order, created_at, updated_at)
VALUES ('vrt-clean-target-1', 'vrt-cat-populated', 'トイレ掃除', 30, 'days', 1, 0,
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO cleaning_targets (id, cat_id, name, frequency_value, frequency_unit, is_active, sort_order, created_at, updated_at)
VALUES ('vrt-clean-target-2', 'vrt-cat-populated', 'ケージ掃除', 14, 'days', 1, 1,
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO cleaning_records (id, cat_id, cleaning_target_id, performed_at, created_at, updated_at)
VALUES ('vrt-clean-record-1', 'vrt-cat-populated', 'vrt-clean-target-1', strftime('%s', '2024-06-01 09:00:00'),
  strftime('%s', '2024-06-01 09:00:00'), strftime('%s', '2024-06-01 09:00:00'));

INSERT INTO hospital_visits (id, cat_id, visited_at, reason, created_at, updated_at)
VALUES ('vrt-hospital-1', 'vrt-cat-populated', strftime('%s', '2024-06-05 09:00:00'), '定期健診',
  strftime('%s', '2024-06-05 09:00:00'), strftime('%s', '2024-06-05 09:00:00'));

INSERT INTO expense_records (id, spent_at, amount_yen, category, created_at, updated_at)
VALUES ('vrt-expense-1', strftime('%s', '2024-06-10 00:00:00'), 3000, 'food',
  strftime('%s', '2024-06-10 00:00:00'), strftime('%s', '2024-06-10 00:00:00'));

INSERT INTO expense_record_cats (expense_record_id, cat_id)
VALUES ('vrt-expense-1', 'vrt-cat-populated');

INSERT INTO feeding_records (id, cat_id, occurred_at, created_at, updated_at)
VALUES ('vrt-feeding-1', 'vrt-cat-populated', strftime('%s', '2024-06-15 08:00:00'),
  strftime('%s', '2024-06-15 08:00:00'), strftime('%s', '2024-06-15 08:00:00'));

INSERT INTO feeding_record_items (id, feeding_record_id, food_product_id, given_amount_g, leftover_amount_g, estimated_intake_g, estimated_kcal, sort_order)
VALUES ('vrt-feeding-item-1', 'vrt-feeding-1', 'vrt-food-1', 50, 0, 50, 175, 0);

-- 服薬予定: med-1 は投薬実績あり、med-2 はなし（ネストした一覧の両ケースに使う）
INSERT INTO medications (id, cat_id, name, dose_amount, doses_per_day, start_date, created_at, updated_at)
VALUES ('vrt-med-1', 'vrt-cat-populated', 'VRT抗生剤', '1錠', 2, '2024-06-01',
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO medications (id, cat_id, name, dose_amount, doses_per_day, start_date, created_at, updated_at)
VALUES ('vrt-med-2', 'vrt-cat-populated', 'VRT整腸剤', '0.5錠', 1, '2024-06-01',
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO medication_doses (id, cat_id, medication_id, occurred_at, was_administered, created_at, updated_at)
VALUES ('vrt-dose-1', 'vrt-cat-populated', 'vrt-med-1', strftime('%s', '2024-06-02 08:00:00'), 1,
  strftime('%s', '2024-06-02 08:00:00'), strftime('%s', '2024-06-02 08:00:00'));

INSERT INTO cat_photos (id, cat_id, taken_at, created_at, updated_at)
VALUES ('vrt-photo-1', 'vrt-cat-populated', strftime('%s', '2024-06-20 10:00:00'),
  strftime('%s', '2024-06-20 10:00:00'), strftime('%s', '2024-06-20 10:00:00'));

INSERT INTO poop_records (id, cat_id, occurred_at, consistency, created_at, updated_at)
VALUES ('vrt-poop-1', 'vrt-cat-populated', strftime('%s', '2024-06-12 08:00:00'), 'normal',
  strftime('%s', '2024-06-12 08:00:00'), strftime('%s', '2024-06-12 08:00:00'));

INSERT INTO shampoo_records (id, cat_id, performed_at, created_at, updated_at)
VALUES ('vrt-shampoo-1', 'vrt-cat-populated', strftime('%s', '2024-06-08 10:00:00'),
  strftime('%s', '2024-06-08 10:00:00'), strftime('%s', '2024-06-08 10:00:00'));

INSERT INTO symptoms (id, cat_id, symptom_type, onset_at, status, created_at, updated_at)
VALUES ('vrt-symptom-1', 'vrt-cat-populated', 'くしゃみ', strftime('%s', '2024-06-03 09:00:00'), 'resolved',
  strftime('%s', '2024-06-03 09:00:00'), strftime('%s', '2024-06-03 09:00:00'));

INSERT INTO vomit_records (id, cat_id, occurred_at, created_at, updated_at)
VALUES ('vrt-vomit-1', 'vrt-cat-populated', strftime('%s', '2024-06-11 07:00:00'),
  strftime('%s', '2024-06-11 07:00:00'), strftime('%s', '2024-06-11 07:00:00'));

INSERT INTO water_records (id, cat_id, occurred_at, measurement_method, supplied_amount_ml, created_at, updated_at)
VALUES ('vrt-water-1', 'vrt-cat-populated', strftime('%s', '2024-06-14 09:00:00'), 'measuring_cup', 200,
  strftime('%s', '2024-06-14 09:00:00'), strftime('%s', '2024-06-14 09:00:00'));

INSERT INTO weight_records (id, cat_id, occurred_at, input_method, cat_weight_kg, bcs, created_at, updated_at)
VALUES ('vrt-weight-1', 'vrt-cat-populated', strftime('%s', '2024-06-09 08:00:00'), 'direct', 4.2, 3,
  strftime('%s', '2024-06-09 08:00:00'), strftime('%s', '2024-06-09 08:00:00'));
