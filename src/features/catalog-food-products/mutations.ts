import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { catalogFoodProducts, mediaAssets } from "@/db/schema";
import {
  formatBytes,
  hasStorageCapacity,
  resolveMediaLimits,
} from "@/features/media/limits";
import { buildObjectKey } from "@/features/media/objectKey";
import { sumMediaStorageBytes } from "@/features/media/queries";
import { type MediaEnv, MediaUploadError } from "@/features/media/storage";
import type { CatalogImage } from "./image";
import { CATALOG_FOOD_PRODUCT_MEDIA_TYPE } from "./media";
import type { CatalogFoodProductInput } from "./schema";

/*
 * 共通のごはん商品の保存。AI との接続（MCP）から使う（管理画面は `packages/admin` で別に書く）。
 * admin のユーザーであることは呼び出し元で確かめる。MCP は Durable Object の中で動き
 * `getCloudflareContext()` を使えないため、D1・R2 は引数で受け取る
 */

/**
 * 列に書く値。管理画面と同じく、`package_amount_g`・`package_unit` には先頭の候補を、
 * `package_sizes` には先頭を含むすべての候補を書く（`catalogPackageSizes` 参照）
 */
function toColumns(values: CatalogFoodProductInput) {
  const [first] = values.packageSizes;
  return {
    name: values.name,
    manufacturer: values.manufacturer,
    kcalPer100g: values.kcalPer100g,
    packageAmountG: first.amountG,
    packageUnit: first.unit,
    packageSizes: values.packageSizes,
    nutritionType: values.nutritionType,
    textureType: values.textureType,
    lifeStages: values.lifeStages,
    targetBreed: values.targetBreed,
    searchKeywords: values.searchKeywords,
  };
}

/** 共通のごはん商品を登録し、ID を返す */
export async function createCatalogFoodProduct(
  values: CatalogFoodProductInput,
  d1?: D1Database,
): Promise<string> {
  const [created] = await getDb(d1)
    .insert(catalogFoodProducts)
    .values(toColumns(values))
    .returning({ id: catalogFoodProducts.id });
  return created.id;
}

/**
 * 共通のごはん商品を更新する。家に追加済みのごはん商品は内容を写したものなので、変更は
 * 反映されない。商品がなければ false
 */
export async function updateCatalogFoodProduct(
  id: string,
  values: CatalogFoodProductInput,
  d1?: D1Database,
): Promise<boolean> {
  const updated = await getDb(d1)
    .update(catalogFoodProducts)
    .set({ ...toColumns(values), updatedAt: new Date() })
    .where(eq(catalogFoodProducts.id, id))
    .returning({ id: catalogFoodProducts.id });
  return updated.length > 0;
}

function isProductImage(productId: string) {
  return and(
    eq(mediaAssets.recordType, CATALOG_FOOD_PRODUCT_MEDIA_TYPE),
    eq(mediaAssets.recordId, productId),
  );
}

/**
 * 共通のごはん商品の画像を差し替える（画像は 1 商品に 1 枚）。管理画面の差し替え
 * （`packages/admin/src/db/catalogFoodProducts.ts`）と同じく、サムネイルは作らずに画像だけを置き、
 * 同じ batch の中でその時点の画像の行をすべて削除してから新しい行を追加する。
 * 保存容量の上限は、削除するこの商品の今の画像の分を差し引いた、差し替え後の使用容量で確かめ、
 * 超えるときは `MediaUploadError` を投げる。商品がなければ何も保存せずに false
 */
export async function replaceCatalogFoodProductImage(
  productId: string,
  image: CatalogImage,
  env: MediaEnv,
): Promise<boolean> {
  const db = getDb(env.DB);
  const limits = resolveMediaLimits();
  const [current] = await db
    .select({
      total: sql<number>`coalesce(sum(${mediaAssets.sizeBytes}), 0) + coalesce(sum(${mediaAssets.thumbnailSizeBytes}), 0)`,
    })
    .from(mediaAssets)
    .where(isProductImage(productId));
  const usedBytes =
    (await sumMediaStorageBytes(env.DB)) - Number(current?.total ?? 0);
  if (!hasStorageCapacity(usedBytes, image.bytes.byteLength, limits)) {
    throw new MediaUploadError(
      `保存容量の上限（${formatBytes(limits.storageLimitBytes)}）を超えるためアップロードできません`,
      507,
    );
  }

  const assetId = crypto.randomUUID();
  const objectKey = buildObjectKey(
    CATALOG_FOOD_PRODUCT_MEDIA_TYPE,
    productId,
    assetId,
  );
  await env.MEDIA_BUCKET.put(objectKey, image.bytes, {
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
    await env.MEDIA_BUCKET.delete(objectKey).catch(() => {});
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
    await env.MEDIA_BUCKET.delete(unusedKeys).catch((error: unknown) => {
      console.error(
        "使われない画像を R2 から削除できませんでした",
        unusedKeys,
        error,
      );
    });
  }
  return added.length > 0;
}
