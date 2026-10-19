-- 共通のごはん商品に内容量の候補（#346）の列を追加し、今の内容量を 1 件目の候補として埋める。
-- 列を追加するだけで既存の package_amount_g・package_unit は残すため、古いコードのまま先に適用しても
-- 影響はない。新しいコードはこの列が無いと共通のごはん商品の検索・管理画面が表示できないため、
-- マージ（デプロイ）より前に pnpm db:migrate:remote で適用すること。
ALTER TABLE `catalog_food_products` ADD `package_sizes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `catalog_food_products`
SET `package_sizes` = json_array(json_object('amountG', `package_amount_g`, 'unit', `package_unit`));
