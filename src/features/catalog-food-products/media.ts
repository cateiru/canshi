/**
 * 共通のごはん商品の画像の `media_assets.record_type`。管理画面（`packages/admin`）だけが
 * アップロード・削除する。メインアプリからは添付先として選べないよう `MEDIA_RECORD_TYPES` には
 * 含めず、ログイン中のユーザーなら誰でも参照できるが削除はできない（`src/features/media/access.ts`）
 */
export const CATALOG_FOOD_PRODUCT_MEDIA_TYPE = "catalog_food_product";
