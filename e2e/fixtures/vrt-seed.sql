-- ビジュアルリグレッションテスト (Chromatic) 用の固定フィクスチャデータ。
-- `pnpm db:migrate:local` 直後のローカル D1、および CI の vrt ジョブに適用する
-- (README.md / .github/workflows/ci.yml 参照)。
--
-- 猫は4匹だけ用意する。
-- - vrt-cat-empty     : どの記録も一切登録しない（各記録一覧の「何もないケース」用）
-- - vrt-cat-populated : 各記録種別を1件ずつ登録する（「データがあるケース」用）。
--   掃除記録・服薬予定はネストした一覧ページの「データがある/何もない」の両方を
--   このデータだけで再現するため、対象/服薬予定をそれぞれ2件（1件は記録なし）にする。
--   メモは日付ありと日付なしの両方のカードを撮るため2件にする。
-- - vrt-cat-busy      : 同じ日に5種類の記録を登録する（タイムラインのカレンダーで
--   1日のアイコンが表示上限を超えて「+1」になるケース用）。vrt-cat-populated の
--   「各記録種別を1件ずつ」を崩さないよう別の猫にしている。猫一覧で末尾に並ぶよう
--   created_at は他の2匹より前にする。
--   あわせて、水の記録を 51 件登録する（記録一覧のページング用。1 ページ 50 件のため 2 ページになる）。
-- - vrt-cat-approximate : あいまいモードのごはん記録だけを登録する（ごはん記録一覧・
--   タイムラインのあいまいモード表示用）。vrt-cat-populated の「各記録種別を1件ずつ」を
--   崩さないよう別の猫にしている。猫一覧で vrt-cat-busy のさらに後ろに並ぶよう
--   created_at は他の3匹より前にする。
--
-- ごはんプリセットは厳格モード・あいまいモードを1件ずつ登録する（プリセット一覧と、
-- 記録フォームのプリセット選択ボタンの表示用）。
--
-- 日時はすべて実行日時に依存しない固定値 (2024-06) にする。VRT の対象ページは
-- 「今日」からの相対計算をしないもの（占める割合の大半）に限定しているため、
-- 固定値であればスナップショットは実行日に関わらず安定する
-- (e2e/vrt.spec.ts のコメントで対象外にしているページを参照)。

-- 猫はすべて VRT 用の家に所属させる。`/login` の開発用ログインで VRT ユーザーとして
-- ログインできるよう、e2e/auth.setup.ts がログインに使うメールアドレス（e2e@example.com）を
-- 開発用の SALT でハッシュにした値を email_hash にする
-- (src/features/auth/emailHash.test.ts で同じ値になることを確認している)
INSERT INTO users (id, name, role, email_hash, created_at, updated_at)
VALUES ('vrt-user', 'VRTユーザー', 'admin',
  '67534d9e2c2cbdba8b5cc51b13f29cda8a204335369ea791404d411d86e9a59e',
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO households (id, name, created_at, updated_at)
VALUES ('vrt-household', 'VRTの家',
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO household_members (household_id, user_id, role, created_at)
VALUES ('vrt-household', 'vrt-user', 'owner', strftime('%s', '2024-06-01 00:00:00'));

-- 家への招待（招待ページ・家の詳細設定の招待一覧用）。トークンはハッシュだけを保存するため、
-- 招待ページは固定のトークン（e2e/vrt.spec.ts の VRT_INVITATION_TOKENS）を SHA-256 にした
-- 値で引けるようにする。有効期限は実行日に関わらず期限内になるよう遠い未来にする
-- - vrt-invitation-member : VRTの家への招待。VRT ユーザーはすでにメンバーのため
--   「すでにメンバーです」の表示になる。家の詳細設定の「まだ使われていない招待」にも並ぶ
-- - vrt-invitation-valid  : VRT ユーザーが所属していない別の家への招待（「参加する」の表示用）。
--   招待した人は VRT ユーザーとは別のユーザーにする
INSERT INTO users (id, name, role, created_at, updated_at)
VALUES ('vrt-inviter', 'VRT招待者', 'member',
  strftime('%s', '2024-06-02 00:00:00'), strftime('%s', '2024-06-02 00:00:00'));

INSERT INTO households (id, name, created_at, updated_at)
VALUES ('vrt-invite-household', 'VRT招待元の家',
  strftime('%s', '2024-06-02 00:00:00'), strftime('%s', '2024-06-02 00:00:00'));

INSERT INTO household_members (household_id, user_id, role, created_at)
VALUES ('vrt-invite-household', 'vrt-inviter', 'owner', strftime('%s', '2024-06-02 00:00:00'));

-- VRT招待者のログインセッション（管理画面の VRT（e2e-admin/vrt.spec.ts）で、ユーザー一覧に
-- 有効なセッションと「すべての端末からログアウト」のボタンを表示する用）。期限は実行日に
-- 関わらず期限内になるよう遠い未来にする。トークンを持つ端末はないため、メインアプリでは使われない
INSERT INTO sessions (token_hash, id, user_id, expires_at, created_at)
VALUES ('vrt-inviter-session-token-hash', 'vrt-inviter-session', 'vrt-inviter',
  strftime('%s', '2099-12-31 00:00:00'), strftime('%s', '2024-06-02 00:00:00'));

INSERT INTO household_invitations (id, household_id, token_hash, created_by_user_id, expires_at, created_at)
VALUES
  ('vrt-invitation-member', 'vrt-household',
    'bf7adb758fd19575bbe4a26e6c7150f68255cb640bfb4bc8b5002c4632bec702', 'vrt-user',
    strftime('%s', '2099-12-31 00:00:00'), strftime('%s', '2024-06-01 00:00:00')),
  ('vrt-invitation-valid', 'vrt-invite-household',
    'd50cba6528a3c95064f916588f74e203d382b13fb8392e0825ded3a1c03f0a11', 'vrt-inviter',
    strftime('%s', '2099-12-31 00:00:00'), strftime('%s', '2024-06-02 00:00:00'));

-- 家のごはんの時間。通知を有効にすると、撮影する時刻によって通知センターなどの見た目が
-- 変わってしまうため、どちらの通知も無効にしておく
INSERT INTO feeding_schedules (id, household_id, time, notify_at_time, remind_if_not_recorded, created_at, updated_at)
VALUES
  ('vrt-feeding-morning', 'vrt-household', '07:00', 0, 0,
    strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00')),
  ('vrt-feeding-evening', 'vrt-household', '19:00', 0, 0,
    strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO cats (id, name, sex, birth_date, breed, adopted_at, created_at, updated_at)
VALUES ('vrt-cat-empty', 'VRT空猫', 'unknown', NULL, NULL, NULL,
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO cats (id, name, sex, birth_date, breed, adopted_at, created_at, updated_at)
VALUES ('vrt-cat-populated', 'VRTテスト猫', 'female', '2015-04-01', '雑種', '2015-06-01',
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO cats (id, name, sex, birth_date, breed, adopted_at, created_at, updated_at)
VALUES ('vrt-cat-busy', 'VRT記録多数猫', 'unknown', NULL, NULL, NULL,
  strftime('%s', '2024-05-31 00:00:00'), strftime('%s', '2024-05-31 00:00:00'));

-- 共通のごはん商品（管理画面から登録し、ごはん商品の登録時に検索して家に追加する）。
-- vrt-catalog-1 は VRT の家に追加済み（vrt-food-1 の追加元）、vrt-catalog-2 は未追加で、
-- 検索結果の「追加済み」と「追加する」の両方を再現する。vrt-catalog-2 は内容量の候補を 2 つ持ち、
-- 追加するボタンの内容量のメニューを再現する。画像は R2 に置けないため持たない
INSERT INTO catalog_food_products (id, name, manufacturer, kcal_per_100g, package_amount_g, package_unit, nutrition_type, texture_type, life_stages, target_breed, package_sizes, created_at, updated_at)
VALUES
  ('vrt-catalog-1', 'VRTテストフード', 'VRTフーズ', 350, 1000, NULL, 'complete', 'dry', '["adult","senior"]', 'ペルシャ',
    '[{"amountG":1000,"unit":null}]',
    strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00')),
  ('vrt-catalog-2', 'VRTまぐろパウチ', 'VRTフーズ', 70, 40, '袋', 'general', 'wet', '["kitten"]', NULL,
    '[{"amountG":40,"unit":"袋"},{"amountG":160,"unit":null}]',
    strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

-- 共通のごはん商品のリクエスト（管理画面の VRT（e2e-admin/vrt.spec.ts）で、対応を待っているリクエストと
-- 完了にしたリクエストの表を表示する用）。メインアプリの検索ページの「リクエスト済み」の表示に
-- 影響しないよう、VRT ユーザーではなく VRT招待者のリクエストにする
INSERT INTO catalog_food_product_requests (id, user_id, search_query, label, completed_at, created_at)
VALUES
  ('vrt-request-open', 'vrt-inviter', 'q=%E3%81%BE%E3%81%90%E3%82%8D&textureType=wet',
    'キーワード：まぐろ、種類：ウェット', NULL, strftime('%s', '2024-06-03 00:00:00')),
  ('vrt-request-done', 'vrt-inviter', 'q=VRT%E3%83%86%E3%82%B9%E3%83%88%E3%83%95%E3%83%BC%E3%83%89',
    'キーワード：VRTテストフード', strftime('%s', '2024-06-04 00:00:00'), strftime('%s', '2024-06-02 00:00:00'));

-- メーカー名・対象の猫・猫種も入れ、商品一覧のカードで表示されるケースを再現する
INSERT INTO food_products (id, name, manufacturer, kcal_per_100g, package_amount_g, nutrition_type, texture_type, life_stages, target_breed, catalog_food_product_id, created_at, updated_at)
VALUES ('vrt-food-1', 'VRTテストフード', 'VRTフーズ', 350, 1000, 'complete', 'dry', '["adult","senior"]', 'ペルシャ', 'vrt-catalog-1',
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

-- 掃除記録: target-1 は記録あり、target-2 は記録なし（ネストした一覧の両ケースに使う）。
-- target-1 は前回の実施が 2024-06-01 で実行日には常に期限超過になるため、通知時刻も
-- 設定して「期限超過」と「○○に通知」のバッジが並ぶケースを再現する
INSERT INTO cleaning_targets (id, cat_id, name, frequency_value, frequency_unit, notify_time, is_active, sort_order, created_at, updated_at)
VALUES ('vrt-clean-target-1', 'vrt-cat-populated', 'トイレ掃除', 30, 'days', '09:00', 1, 0,
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

-- あいまいモードのごはん記録。グラム単位の値・推定値は持たず、段階だけを持つ
INSERT INTO cats (id, name, sex, birth_date, breed, adopted_at, created_at, updated_at)
VALUES ('vrt-cat-approximate', 'VRTあいまい猫', 'unknown', NULL, NULL, NULL,
  strftime('%s', '2024-05-30 00:00:00'), strftime('%s', '2024-05-30 00:00:00'));

INSERT INTO feeding_records (id, cat_id, occurred_at, mode, created_at, updated_at)
VALUES ('vrt-feeding-approximate-1', 'vrt-cat-approximate', strftime('%s', '2024-06-15 08:00:00'), 'approximate',
  strftime('%s', '2024-06-15 08:00:00'), strftime('%s', '2024-06-15 08:00:00'));

INSERT INTO feeding_record_items (id, feeding_record_id, food_product_id, given_amount_level, leftover_level, sort_order)
VALUES ('vrt-feeding-approximate-item-1', 'vrt-feeding-approximate-1', 'vrt-food-1', 'normal', 'little', 0);

INSERT INTO feeding_presets (id, name, mode, created_at, updated_at)
VALUES ('vrt-preset-strict', 'VRT朝ごはん', 'strict',
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO feeding_preset_items (id, preset_id, food_product_id, given_amount_g, sort_order)
VALUES ('vrt-preset-strict-item-1', 'vrt-preset-strict', 'vrt-food-1', 50, 0);

INSERT INTO feeding_presets (id, name, mode, created_at, updated_at)
VALUES ('vrt-preset-approximate', 'VRTおやつ', 'approximate',
  strftime('%s', '2024-06-02 00:00:00'), strftime('%s', '2024-06-02 00:00:00'));

INSERT INTO feeding_preset_items (id, preset_id, food_product_id, given_amount_level, sort_order)
VALUES ('vrt-preset-approximate-item-1', 'vrt-preset-approximate', 'vrt-food-1', 'less', 0);

-- 服薬予定: med-1 は投薬実績あり、med-2 はなし（ネストした一覧の両ケースに使う）
INSERT INTO medications (id, cat_id, name, dose_amount, doses_per_day, start_date, created_at, updated_at)
VALUES ('vrt-med-1', 'vrt-cat-populated', 'VRT抗生剤', '1錠', 2, '2024-06-01',
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

INSERT INTO medications (id, cat_id, name, dose_amount, doses_per_day, start_date, created_at, updated_at)
VALUES ('vrt-med-2', 'vrt-cat-populated', 'VRT整腸剤', '0.5錠', 1, '2024-06-01',
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

-- 服薬歴: 終了予定日を過ぎた服薬予定（折りたたんだ「服薬歴」に表示される）
INSERT INTO medications (id, cat_id, name, dose_amount, doses_per_day, start_date, end_date, created_at, updated_at)
VALUES ('vrt-med-3', 'vrt-cat-populated', 'VRT点眼薬', '1滴', 3, '2024-05-01', '2024-05-14',
  strftime('%s', '2024-05-01 00:00:00'), strftime('%s', '2024-05-01 00:00:00'));

INSERT INTO medication_doses (id, cat_id, medication_id, occurred_at, was_administered, created_at, updated_at)
VALUES ('vrt-dose-1', 'vrt-cat-populated', 'vrt-med-1', strftime('%s', '2024-06-02 08:00:00'), 1,
  strftime('%s', '2024-06-02 08:00:00'), strftime('%s', '2024-06-02 08:00:00'));

INSERT INTO poop_records (id, cat_id, occurred_at, consistency, created_at, updated_at)
VALUES ('vrt-poop-1', 'vrt-cat-populated', strftime('%s', '2024-06-12 08:00:00'), 'normal',
  strftime('%s', '2024-06-12 08:00:00'), strftime('%s', '2024-06-12 08:00:00'));

INSERT INTO shampoo_records (id, cat_id, performed_at, created_at, updated_at)
VALUES ('vrt-shampoo-1', 'vrt-cat-populated', strftime('%s', '2024-06-08 10:00:00'),
  strftime('%s', '2024-06-08 10:00:00'), strftime('%s', '2024-06-08 10:00:00'));

-- ブラッシング: 任意の項目をすべて入力した記録（一覧のカードとタイムラインで項目の並びを撮る）
INSERT INTO brushing_records (id, cat_id, performed_at, duration_minutes, shed_amount, has_mats, has_skin_issue, memo, created_at, updated_at)
VALUES ('vrt-brushing-1', 'vrt-cat-populated', strftime('%s', '2024-06-16 20:00:00'), 10, 'more', 1, 0,
  'お腹の毛玉をほぐした。',
  strftime('%s', '2024-06-16 20:00:00'), strftime('%s', '2024-06-16 20:00:00'));

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

-- メモ: 日付ありと日付なし（recorded_at が NULL）を1件ずつ登録する（一覧で両方のカードの表示を撮る。
-- 日付なしはタイムラインに出ない）。改行を含めて、本文の折り返し表示も撮る
INSERT INTO memo_records (id, cat_id, recorded_at, content, created_at, updated_at)
VALUES ('vrt-memo-1', 'vrt-cat-populated', strftime('%s', '2024-06-20 21:00:00'),
  'ブラッシングを嫌がらなくなった。' || char(10) || '新しいブラシが気に入ったみたい。',
  strftime('%s', '2024-06-20 21:00:00'), strftime('%s', '2024-06-20 21:00:00'));

INSERT INTO memo_records (id, cat_id, content, created_at, updated_at)
VALUES ('vrt-memo-2', 'vrt-cat-populated', '好きなおもちゃは羽根のついたじゃらし。',
  strftime('%s', '2024-06-01 00:00:00'), strftime('%s', '2024-06-01 00:00:00'));

-- vrt-cat-busy: 水の記録を 1 ページの表示件数（50 件）より 1 件多い 51 件登録する（記録一覧の
-- ページングの表示用。1 ページ目は 50 件、2 ページ目は 1 件になる）。2024-01-01 から 1 日 1 件で、
-- タイムラインの VRT で撮る月（2024-06）とその前後の月にかからないようにする
INSERT INTO water_records (id, cat_id, occurred_at, measurement_method, supplied_amount_ml, created_at, updated_at)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 51)
SELECT 'vrt-busy-water-' || n, 'vrt-cat-busy',
  strftime('%s', '2024-01-01 09:00:00', '+' || (n - 1) || ' days'), 'measuring_cup', 200,
  strftime('%s', '2024-01-01 09:00:00', '+' || (n - 1) || ' days'),
  strftime('%s', '2024-01-01 09:00:00', '+' || (n - 1) || ' days')
FROM seq;

-- vrt-cat-busy: 2024-06-18 に5種類の記録を登録する（カレンダーは4種類まで表示し、残りを「+1」にする）
INSERT INTO poop_records (id, cat_id, occurred_at, consistency, created_at, updated_at)
VALUES ('vrt-busy-poop-1', 'vrt-cat-busy', strftime('%s', '2024-06-18 08:00:00'), 'normal',
  strftime('%s', '2024-06-18 08:00:00'), strftime('%s', '2024-06-18 08:00:00'));

INSERT INTO weight_records (id, cat_id, occurred_at, input_method, cat_weight_kg, bcs, created_at, updated_at)
VALUES ('vrt-busy-weight-1', 'vrt-cat-busy', strftime('%s', '2024-06-18 09:00:00'), 'direct', 3.8, 3,
  strftime('%s', '2024-06-18 09:00:00'), strftime('%s', '2024-06-18 09:00:00'));

INSERT INTO vomit_records (id, cat_id, occurred_at, created_at, updated_at)
VALUES ('vrt-busy-vomit-1', 'vrt-cat-busy', strftime('%s', '2024-06-18 10:00:00'),
  strftime('%s', '2024-06-18 10:00:00'), strftime('%s', '2024-06-18 10:00:00'));

INSERT INTO shampoo_records (id, cat_id, performed_at, created_at, updated_at)
VALUES ('vrt-busy-shampoo-1', 'vrt-cat-busy', strftime('%s', '2024-06-18 11:00:00'),
  strftime('%s', '2024-06-18 11:00:00'), strftime('%s', '2024-06-18 11:00:00'));

INSERT INTO symptoms (id, cat_id, symptom_type, onset_at, status, created_at, updated_at)
VALUES ('vrt-busy-symptom-1', 'vrt-cat-busy', 'くしゃみ', strftime('%s', '2024-06-18 12:00:00'), 'resolved',
  strftime('%s', '2024-06-18 12:00:00'), strftime('%s', '2024-06-18 12:00:00'));

-- 通院記録の作成時に「支出記録と紐付けますか？」のモーダルを出すための、同じ日（2024-05-20）の
-- 「病院」の支出記録。候補が複数のとき（ラジオボタンで選ぶ形）を撮るため 2 件にする。
-- 既存の VRT が表示する 2024-06 や vrt-cat-populated・vrt-cat-empty の一覧に出ないよう、
-- 別の月の vrt-cat-busy の支出にする
INSERT INTO expense_records (id, spent_at, amount_yen, category, memo, created_at, updated_at)
VALUES ('vrt-expense-hospital-1', strftime('%s', '2024-05-20 00:00:00'), 11000, 'hospital', '2匹分の診察代',
  strftime('%s', '2024-05-20 00:00:00'), strftime('%s', '2024-05-20 00:00:00'));

INSERT INTO expense_records (id, spent_at, amount_yen, category, created_at, updated_at)
VALUES ('vrt-expense-hospital-2', strftime('%s', '2024-05-20 00:00:00'), 1500, 'hospital',
  strftime('%s', '2024-05-20 00:00:01'), strftime('%s', '2024-05-20 00:00:01'));

INSERT INTO expense_record_cats (expense_record_id, cat_id)
VALUES ('vrt-expense-hospital-1', 'vrt-cat-busy'), ('vrt-expense-hospital-2', 'vrt-cat-busy');

-- AIとの接続（設定の「AIとの接続」の一覧用）。`@cloudflare/workers-oauth-provider` が
-- `oauth_kv_entries` に保存するのと同じキー・形式で、VRT ユーザーが同意した接続を 1 件と、
-- 接続したクライアントの登録を入れる（src/features/mcp/connections.ts 参照）。
-- createdAt は unix 秒の固定値（2024-06-01 00:00:00 UTC）
INSERT INTO oauth_kv_entries (key, value)
VALUES ('client:vrt-client', '{"clientId":"vrt-client","clientName":"ChatGPT","redirectUris":["https://chatgpt.com/connector/oauth/callback"]}'),
  ('grant:vrt-user:vrtGrant', '{"id":"vrtGrant","clientId":"vrt-client","userId":"vrt-user","scope":[],"metadata":{},"encryptedProps":"","createdAt":1717200000,"redirectUri":"https://chatgpt.com/connector/oauth/callback"}');

-- 上の接続を最後に使った日時（src/features/mcp/usages.ts 参照）。unix 秒の固定値
-- （2024-06-02 01:00:00 UTC）
INSERT INTO mcp_connection_usages (user_id, grant_id, last_used_at)
VALUES ('vrt-user', 'vrtGrant', 1717290000);

-- ここまでに登録した猫をすべて VRT 用の家に所属させる
UPDATE cats SET household_id = 'vrt-household' WHERE id LIKE 'vrt-cat-%';

-- 支出記録は家に属するため、ここまでに登録した支出記録も VRT 用の家の支出にする
UPDATE expense_records SET household_id = 'vrt-household' WHERE id LIKE 'vrt-expense-%';

-- ごはん商品・プリセットも家に属するため、ここまでに登録した商品・プリセットも VRT 用の家のものにする
UPDATE food_products SET household_id = 'vrt-household' WHERE id LIKE 'vrt-food-%';
UPDATE feeding_presets SET household_id = 'vrt-household' WHERE id LIKE 'vrt-preset-%';
