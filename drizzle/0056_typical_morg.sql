-- 共通のごはん商品に検索キーワード（#366）の列を追加する。列を追加するだけなので、古いコードのまま
-- 先に適用しても影響はない。新しいコードはこの列が無いと共通のごはん商品の検索・管理画面が表示できないため、
-- マージ（デプロイ）より前に pnpm db:migrate:remote で適用すること。
ALTER TABLE `catalog_food_products` ADD `search_keywords` text DEFAULT '[]' NOT NULL;
