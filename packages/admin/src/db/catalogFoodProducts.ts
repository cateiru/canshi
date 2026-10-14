/**
 * 共通のごはん商品（`catalog_food_products`）と、その画像（`media_assets` の
 * `record_type = 'catalog_food_product'`・R2 のオブジェクト）を読み書きする。
 *
 * `queries.ts` と同じく、メインアプリの Drizzle スキーマ・メディアの処理は import せず生の SQL と
 * R2 の API で書く。画像は 1 商品に 1 枚で、メインアプリのメディアと同じく
 * `{record_type}/{record_id}/{asset_id}` のキーで R2 に置く。管理画面はサムネイルを作らないため
 * `thumbnail_object_key` は NULL にする（メインアプリは元データの URL で表示する）
 */
import type {
  CatalogFoodProductValues,
  LifeStage,
  NutritionType,
  TextureType,
} from "../catalog/form";
import type { CatalogImageMimeType } from "../catalog/image";
import type { AdminDb } from "./queries";

/** メインアプリの `CATALOG_FOOD_PRODUCT_MEDIA_TYPE` と同じ値 */
export const CATALOG_FOOD_PRODUCT_MEDIA_TYPE = "catalog_food_product";

/** このファイルが使う R2 の機能（テストで差し替えるため最小限にする） */
export type AdminBucket = Pick<R2Bucket, "put" | "get" | "delete">;

export interface CatalogFoodProduct extends CatalogFoodProductValues {
  id: string;
  /** 画像の `media_assets.id`。画像がなければ null */
  imageAssetId: string | null;
  /** この商品から家に追加されたごはん商品の数 */
  addedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogImage {
  objectKey: string;
  mimeType: string;
}

export interface NewCatalogImage {
  bytes: Uint8Array;
  mimeType: CatalogImageMimeType;
}

type CatalogFoodProductRow = {
  id: string;
  name: string;
  manufacturer: string | null;
  kcal_per_100g: number;
  package_amount_g: number;
  package_unit: string | null;
  nutrition_type: NutritionType;
  texture_type: TextureType;
  life_stages: string;
  target_breed: string | null;
  image_asset_id: string | null;
  added_count: number;
  created_at: number;
  updated_at: number;
};

type ImageRow = {
  id: string;
  object_key: string;
  thumbnail_object_key: string | null;
  mime_type: string;
};

const SELECT_SQL = `
SELECT
  c.*,
  (
    SELECT m.id FROM media_assets m
    WHERE m.record_type = '${CATALOG_FOOD_PRODUCT_MEDIA_TYPE}' AND m.record_id = c.id
    ORDER BY m.sort_order, m.created_at
    LIMIT 1
  ) AS image_asset_id,
  (SELECT COUNT(*) FROM food_products f WHERE f.catalog_food_product_id = c.id) AS added_count
FROM catalog_food_products c`;

function parseLifeStages(value: string): LifeStage[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as LifeStage[]) : [];
  } catch {
    return [];
  }
}

function toCatalogFoodProduct(row: CatalogFoodProductRow): CatalogFoodProduct {
  return {
    id: row.id,
    name: row.name,
    manufacturer: row.manufacturer,
    kcalPer100g: row.kcal_per_100g,
    packageAmountG: row.package_amount_g,
    packageUnit: row.package_unit,
    nutritionType: row.nutrition_type,
    textureType: row.texture_type,
    lifeStages: parseLifeStages(row.life_stages),
    targetBreed: row.target_breed,
    imageAssetId: row.image_asset_id,
    addedCount: row.added_count,
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
  };
}

function objectKeysOf(rows: ImageRow[]) {
  return rows.flatMap((row) =>
    row.thumbnail_object_key
      ? [row.object_key, row.thumbnail_object_key]
      : [row.object_key],
  );
}

/** 共通のごはん商品の一覧。メインアプリの検索結果と同じく、メーカー名・商品名の順 */
export async function listCatalogFoodProducts(
  db: AdminDb,
): Promise<CatalogFoodProduct[]> {
  const { results } = await db
    .prepare(
      `${SELECT_SQL}
      ORDER BY c.manufacturer IS NULL, c.manufacturer, c.name, c.id`,
    )
    .all<CatalogFoodProductRow>();
  return results.map(toCatalogFoodProduct);
}

export async function getCatalogFoodProduct(
  db: AdminDb,
  id: string,
): Promise<CatalogFoodProduct | null> {
  const { results } = await db
    .prepare(`${SELECT_SQL} WHERE c.id = ?1`)
    .bind(id)
    .all<CatalogFoodProductRow>();
  return results[0] ? toCatalogFoodProduct(results[0]) : null;
}

async function listImageRows(db: AdminDb, productId: string) {
  const { results } = await db
    .prepare(
      `SELECT id, object_key, thumbnail_object_key, mime_type FROM media_assets
      WHERE record_type = ?1 AND record_id = ?2
      ORDER BY sort_order, created_at`,
    )
    .bind(CATALOG_FOOD_PRODUCT_MEDIA_TYPE, productId)
    .all<ImageRow>();
  return results;
}

export async function getCatalogImage(
  db: AdminDb,
  productId: string,
): Promise<CatalogImage | null> {
  const [row] = await listImageRows(db, productId);
  return row ? { objectKey: row.object_key, mimeType: row.mime_type } : null;
}

/**
 * 画像を R2 に置き、`media_assets` に追加する文を返す。文を実行する前に失敗したときのため、
 * 置いたオブジェクトのキーも返す（呼び出し側が片付ける）
 */
async function putImage(
  db: AdminDb,
  bucket: AdminBucket,
  productId: string,
  image: NewCatalogImage,
) {
  const assetId = crypto.randomUUID();
  const objectKey = `${CATALOG_FOOD_PRODUCT_MEDIA_TYPE}/${productId}/${assetId}`;
  await bucket.put(objectKey, image.bytes, {
    httpMetadata: { contentType: image.mimeType },
  });
  const statement = db
    .prepare(
      `INSERT INTO media_assets
        (id, cat_id, uploaded_by_user_id, record_type, record_id, object_key,
         thumbnail_object_key, mime_type, size_bytes, sort_order)
      VALUES (?1, NULL, NULL, ?2, ?3, ?4, NULL, ?5, ?6, 0)`,
    )
    .bind(
      assetId,
      CATALOG_FOOD_PRODUCT_MEDIA_TYPE,
      productId,
      objectKey,
      image.mimeType,
      image.bytes.byteLength,
    );
  return { objectKey, statement };
}

/** 文を実行し、失敗したら先に置いた画像を R2 から片付けて投げ直す */
async function batchWithImage(
  db: AdminDb,
  bucket: AdminBucket,
  statements: D1PreparedStatement[],
  uploadedKey: string | null,
) {
  try {
    await db.batch(statements);
  } catch (error) {
    if (uploadedKey) {
      await bucket.delete(uploadedKey).catch(() => {});
    }
    throw error;
  }
}

function valueParams(values: CatalogFoodProductValues) {
  return [
    values.name,
    values.manufacturer,
    values.kcalPer100g,
    values.packageAmountG,
    values.packageUnit,
    values.nutritionType,
    values.textureType,
    JSON.stringify(values.lifeStages),
    values.targetBreed,
  ];
}

/** 共通のごはん商品を登録し、ID を返す */
export async function createCatalogFoodProduct(
  db: AdminDb,
  bucket: AdminBucket,
  values: CatalogFoodProductValues,
  image: NewCatalogImage | null,
): Promise<string> {
  const id = crypto.randomUUID();
  const insert = db
    .prepare(
      `INSERT INTO catalog_food_products
        (id, name, manufacturer, kcal_per_100g, package_amount_g, package_unit,
         nutrition_type, texture_type, life_stages, target_breed)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(id, ...valueParams(values));
  const uploaded = image ? await putImage(db, bucket, id, image) : null;
  // 商品の行を先に作る（画像の行は商品を参照しないが、商品のない画像を残さないため同じ batch にする）
  await batchWithImage(
    db,
    bucket,
    uploaded ? [insert, uploaded.statement] : [insert],
    uploaded?.objectKey ?? null,
  );
  return id;
}

/**
 * 共通のごはん商品を更新する。家に追加済みのごはん商品は内容を写したものなので、変更は
 * 反映されない。新しい画像を選んだとき・画像の削除を選んだときは、それまでの画像を削除する。
 * 商品がなければ false
 */
export async function updateCatalogFoodProduct(
  db: AdminDb,
  bucket: AdminBucket,
  id: string,
  values: CatalogFoodProductValues,
  options: { image: NewCatalogImage | null; removeImage: boolean },
): Promise<boolean> {
  if (!(await getCatalogFoodProduct(db, id))) {
    return false;
  }
  const replacesImage = options.image != null || options.removeImage;
  const oldImages = replacesImage ? await listImageRows(db, id) : [];
  const uploaded = options.image
    ? await putImage(db, bucket, id, options.image)
    : null;

  const statements = [
    db
      .prepare(
        `UPDATE catalog_food_products SET
          name = ?2, manufacturer = ?3, kcal_per_100g = ?4, package_amount_g = ?5,
          package_unit = ?6, nutrition_type = ?7, texture_type = ?8, life_stages = ?9,
          target_breed = ?10, updated_at = unixepoch()
        WHERE id = ?1`,
      )
      .bind(id, ...valueParams(values)),
    ...oldImages.map((row) =>
      db.prepare("DELETE FROM media_assets WHERE id = ?1").bind(row.id),
    ),
    ...(uploaded ? [uploaded.statement] : []),
  ];
  await batchWithImage(db, bucket, statements, uploaded?.objectKey ?? null);

  // 古い画像の行はもう無いため、R2 の削除に失敗しても参照先のない行は残らない。
  // 失敗したときは R2 に使われないオブジェクトが残るだけなので、記録して続ける
  const oldKeys = objectKeysOf(oldImages);
  if (oldKeys.length > 0) {
    await bucket.delete(oldKeys).catch((error: unknown) => {
      console.error("古い画像を R2 から削除できませんでした", oldKeys, error);
    });
  }
  return true;
}

/**
 * 共通のごはん商品を削除する。家に追加済みのごはん商品は残り、追加元
 * （`food_products.catalog_food_product_id`）だけが外部キーの ON DELETE SET NULL で NULL になる。
 * 画像は R2 のオブジェクトを先に削除し、失敗したときは行を残して投げる（メインアプリの
 * `deleteMediaAssetRows` と同じく、行だけが消えて R2 に孤立したオブジェクトが残るのを避ける）。
 * 商品がなければ false
 */
export async function deleteCatalogFoodProduct(
  db: AdminDb,
  bucket: AdminBucket,
  id: string,
): Promise<boolean> {
  if (!(await getCatalogFoodProduct(db, id))) {
    return false;
  }
  const images = await listImageRows(db, id);
  const keys = objectKeysOf(images);
  if (keys.length > 0) {
    await bucket.delete(keys);
  }
  await db.batch([
    db
      .prepare(
        "DELETE FROM media_assets WHERE record_type = ?1 AND record_id = ?2",
      )
      .bind(CATALOG_FOOD_PRODUCT_MEDIA_TYPE, id),
    db.prepare("DELETE FROM catalog_food_products WHERE id = ?1").bind(id),
  ]);
  return true;
}
