/**
 * 共通のごはん商品の画像の `media_assets.record_type`。管理画面（`packages/admin`）と、
 * admin のユーザーの AI との接続（MCP）だけがアップロード・差し替えする。メインアプリからは
 * 添付先として選べないよう `MEDIA_RECORD_TYPES` には含めず、ログイン中のユーザーなら誰でも
 * 参照できるが削除はできない（`src/features/media/access.ts`）
 */
export const CATALOG_FOOD_PRODUCT_MEDIA_TYPE = "catalog_food_product";
