import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { catalogFoodProducts, mediaAssets } from "@/db/schema";
import { buildObjectKey } from "@/features/media/domain/objectKey";
import type { CatalogFoodProductRepository } from "../domain/catalogFoodProductRepository";
import { CATALOG_FOOD_PRODUCT_MEDIA_TYPE } from "../domain/media";

function isProductImage(productId: string) {
  return and(
    eq(mediaAssets.recordType, CATALOG_FOOD_PRODUCT_MEDIA_TYPE),
    eq(mediaAssets.recordId, productId),
  );
}

/**
 * D1・R2 に保存する `CatalogFoodProductRepository`。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1・R2 は引数で受け取る。省略すると Next.js の
 * リクエストのものを使う
 */
export function createCatalogFoodProductRepository(
  d1?: D1Database,
  mediaBucket?: R2Bucket,
): CatalogFoodProductRepository {
  const db = getDb(d1);
  return {
    async add(content) {
      const [created] = await db
        .insert(catalogFoodProducts)
        .values(content)
        .returning({ id: catalogFoodProducts.id });
      return created.id;
    },

    async update(id, content) {
      const updated = await db
        .update(catalogFoodProducts)
        .set({ ...content, updatedAt: new Date() })
        .where(eq(catalogFoodProducts.id, id))
        .returning({ id: catalogFoodProducts.id });
      return updated.length > 0;
    },

    async sumImageBytes(id) {
      const [current] = await db
        .select({
          total: sql<number>`coalesce(sum(${mediaAssets.sizeBytes}), 0) + coalesce(sum(${mediaAssets.thumbnailSizeBytes}), 0)`,
        })
        .from(mediaAssets)
        .where(isProductImage(id));
      return Number(current?.total ?? 0);
    },

    /**
     * 管理画面の差し替え（`packages/admin/src/db/catalogFoodProducts.ts`）と同じく、サムネイルは
     * 作らずに画像だけを置き、同じ batch の中でその時点の画像の行をすべて削除してから新しい行を追加する
     */
    async replaceImage(productId, image) {
      const bucket = mediaBucket ?? getCloudflareContext().env.MEDIA_BUCKET;
      const assetId = crypto.randomUUID();
      const objectKey = buildObjectKey(
        CATALOG_FOOD_PRODUCT_MEDIA_TYPE,
        productId,
        assetId,
      );
      await bucket.put(objectKey, image.bytes, {
        httpMetadata: { contentType: "image/jpeg" },
      });

      let removed: (typeof mediaAssets.$inferSelect)[];
      let added: { id: string }[];
      try {
        // 画像の行は商品を外部キーで参照しないため、同時に商品が削除されていたら追加しない。
        // INSERT ... SELECT では列の既定値が使われないため、列はすべてテーブル定義と同じ並びで書く
        [removed, added] = await db.batch([
          db.delete(mediaAssets).where(isProductImage(productId)).returning(),
          db
            .insert(mediaAssets)
            .select((qb) =>
              qb
                .select({
                  id: sql`${assetId}`.as("id"),
                  catId: sql`NULL`.as("cat_id"),
                  uploadedByUserId: sql`NULL`.as("uploaded_by_user_id"),
                  recordType: sql`${CATALOG_FOOD_PRODUCT_MEDIA_TYPE}`.as(
                    "record_type",
                  ),
                  recordId: catalogFoodProducts.id,
                  objectKey: sql`${objectKey}`.as("object_key"),
                  thumbnailObjectKey: sql`NULL`.as("thumbnail_object_key"),
                  mimeType: sql`'image/jpeg'`.as("mime_type"),
                  sizeBytes: sql`${image.bytes.byteLength}`.as("size_bytes"),
                  thumbnailSizeBytes: sql`NULL`.as("thumbnail_size_bytes"),
                  width: sql`${image.size}`.as("width"),
                  height: sql`${image.size}`.as("height"),
                  sortOrder: sql`0`.as("sort_order"),
                  createdAt: sql`(unixepoch())`.as("created_at"),
                })
                .from(catalogFoodProducts)
                .where(eq(catalogFoodProducts.id, productId)),
            )
            .returning({ id: mediaAssets.id }),
        ]);
      } catch (error) {
        await bucket.delete(objectKey).catch(() => {});
        throw error;
      }

      // 古い画像の行はもう無いため、R2 の削除に失敗しても参照先のない行は残らない。
      // 失敗したときは R2 に使われないオブジェクトが残るだけなので、記録して続ける
      const unusedKeys = removed.flatMap((asset) =>
        asset.thumbnailObjectKey
          ? [asset.objectKey, asset.thumbnailObjectKey]
          : [asset.objectKey],
      );
      if (added.length === 0) {
        unusedKeys.push(objectKey);
      }
      if (unusedKeys.length > 0) {
        await bucket.delete(unusedKeys).catch((error: unknown) => {
          console.error(
            "使われない画像を R2 から削除できませんでした",
            unusedKeys,
            error,
          );
        });
      }
      return added.length > 0;
    },
  };
}
