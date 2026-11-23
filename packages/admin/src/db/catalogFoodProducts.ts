/**
 * 共通のごはん商品（`catalog_food_products`）と、その画像（`media_assets` の
 * `record_type = 'catalog_food_product'`・R2 のオブジェクト）を読み書きする。
 *
 * `queries.ts` と同じく、メインアプリの Drizzle スキーマで読み書きする。メディアの処理は import せず
 * R2 の API で書く。画像は 1 商品に 1 枚で、メインアプリのメディアと同じく
 * `{record_type}/{record_id}/{asset_id}` のキーで R2 に置く。管理画面はサムネイルを作らないため
 * `thumbnail_object_key` は NULL にする（メインアプリは元データの URL で表示する）
 */
import { and, asc, eq, exists, isNull, sql } from "drizzle-orm";
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import { insertWhere } from "../../../../src/db/conditionalInsert";
import type {
  CatalogFoodProductValues,
  LifeStage,
  PackageSize,
} from "../catalog/form";
import type { CatalogImageMimeType } from "../catalog/image";
import type { CatalogFoodProduct } from "../models";
import type { AdminDb } from "./client";
import { catalogFoodProducts, foodProducts, mediaAssets } from "./schema";

/** メインアプリの `CATALOG_FOOD_PRODUCT_MEDIA_TYPE` と同じ値 */
export const CATALOG_FOOD_PRODUCT_MEDIA_TYPE = "catalog_food_product";

/** このファイルが使う R2 の機能（テストで差し替えるため最小限にする） */
export type AdminBucket = Pick<R2Bucket, "put" | "get" | "delete">;

export type { CatalogFoodProduct } from "../models";

export interface CatalogImage {
  objectKey: string;
  mimeType: string;
}

export interface NewCatalogImage {
  bytes: Uint8Array;
  mimeType: CatalogImageMimeType;
}

/**
 * この商品の画像の行（`media_assets`）に絞り込む条件。商品の ID の代わりに列を渡すと、
 * 商品の SELECT の中の相関サブクエリの条件になる
 */
function productImagesCondition(
  productId: string | typeof catalogFoodProducts.id,
) {
  return and(
    eq(mediaAssets.recordType, CATALOG_FOOD_PRODUCT_MEDIA_TYPE),
    eq(mediaAssets.recordId, productId),
  );
}

/** 画像の行のうち、R2 のオブジェクトの片付けと配信に使う列 */
const IMAGE_COLUMNS = {
  id: mediaAssets.id,
  objectKey: mediaAssets.objectKey,
  thumbnailObjectKey: mediaAssets.thumbnailObjectKey,
  mimeType: mediaAssets.mimeType,
};

type ImageRow = {
  id: string;
  objectKey: string;
  thumbnailObjectKey: string | null;
  mimeType: string;
};

/** 商品の一覧・1 件の取得に使う SELECT（画像の ID と、家に追加された数を合わせて読む） */
function selectCatalogFoodProducts(db: AdminDb) {
  const imageAssetId = db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(productImagesCondition(catalogFoodProducts.id))
    .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.createdAt))
    .limit(1);
  return db
    .select({
      product: catalogFoodProducts,
      imageAssetId: sql<string | null>`(${imageAssetId})`,
      addedCount: db.$count(
        foodProducts,
        eq(foodProducts.catalogFoodProductId, catalogFoodProducts.id),
      ),
    })
    .from(catalogFoodProducts);
}

type CatalogFoodProductRow = Awaited<
  ReturnType<typeof selectCatalogFoodProducts>
>[number];

function parseLifeStages(value: unknown): LifeStage[] {
  return Array.isArray(value) ? (value as LifeStage[]) : [];
}

function parseSearchKeywords(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * 内容量の候補。先頭の候補は `package_amount_g`・`package_unit` から取り、`package_sizes` からは
 * 2 件目以降だけを使う（メインアプリの `catalogPackageSizes` と同じ）。候補を知らない古い管理画面が
 * `package_amount_g`・`package_unit` だけを登録・更新した場合も、その値を反映するため
 */
function parsePackageSizes(
  product: CatalogFoodProductRow["product"],
): PackageSize[] {
  const first = { amountG: product.packageAmountG, unit: product.packageUnit };
  const rest: PackageSize[] = Array.isArray(product.packageSizes)
    ? product.packageSizes.slice(1)
    : [];
  return [
    first,
    ...rest.filter(
      (size) => size.amountG !== first.amountG || size.unit !== first.unit,
    ),
  ];
}

function toCatalogFoodProduct({
  product,
  imageAssetId,
  addedCount,
}: CatalogFoodProductRow): CatalogFoodProduct {
  return {
    id: product.id,
    name: product.name,
    manufacturer: product.manufacturer,
    amountUnit: product.amountUnit,
    kcalPer100g: product.kcalPer100g,
    packageSizes: parsePackageSizes(product),
    nutritionType: product.nutritionType,
    textureType: product.textureType,
    lifeStages: parseLifeStages(product.lifeStages),
    targetBreed: product.targetBreed,
    searchKeywords: parseSearchKeywords(product.searchKeywords),
    imageAssetId,
    addedCount,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function objectKeysOf(
  rows: Pick<ImageRow, "objectKey" | "thumbnailObjectKey">[],
) {
  return rows.flatMap((row) =>
    row.thumbnailObjectKey
      ? [row.objectKey, row.thumbnailObjectKey]
      : [row.objectKey],
  );
}

/** 共通のごはん商品の一覧。メインアプリの検索結果と同じく、メーカー名・商品名の順 */
export async function listCatalogFoodProducts(
  db: AdminDb,
): Promise<CatalogFoodProduct[]> {
  const rows = await selectCatalogFoodProducts(db).orderBy(
    asc(isNull(catalogFoodProducts.manufacturer)),
    asc(catalogFoodProducts.manufacturer),
    asc(catalogFoodProducts.name),
    asc(catalogFoodProducts.id),
  );
  return rows.map(toCatalogFoodProduct);
}

export async function getCatalogFoodProduct(
  db: AdminDb,
  id: string,
): Promise<CatalogFoodProduct | null> {
  const [row] = await selectCatalogFoodProducts(db).where(
    eq(catalogFoodProducts.id, id),
  );
  return row ? toCatalogFoodProduct(row) : null;
}

/** 元データとサムネイルを合わせた容量 */
const TOTAL_BYTES = sql<number>`coalesce(sum(${mediaAssets.sizeBytes}), 0) + coalesce(sum(${mediaAssets.thumbnailSizeBytes}), 0)`;

/** 商品の今の画像の、元データとサムネイルを合わせた容量 */
async function sumProductImageBytes(db: AdminDb, productId: string) {
  const [row] = await db
    .select({ total: TOTAL_BYTES })
    .from(mediaAssets)
    .where(productImagesCondition(productId));
  return Number(row?.total ?? 0);
}

function listImageRows(db: AdminDb, productId: string): Promise<ImageRow[]> {
  return db
    .select(IMAGE_COLUMNS)
    .from(mediaAssets)
    .where(productImagesCondition(productId))
    .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.createdAt));
}

export async function getCatalogImage(
  db: AdminDb,
  productId: string,
): Promise<CatalogImage | null> {
  const [row] = await listImageRows(db, productId);
  return row ? { objectKey: row.objectKey, mimeType: row.mimeType } : null;
}

/** メディアの保存容量の上限を超えるため、画像を保存しなかった */
export class StorageLimitError extends Error {
  constructor() {
    super(
      "保存容量の上限を超えるため、画像を保存できませんでした。画像を外すか、不要なメディアを削除してください",
    );
    this.name = "StorageLimitError";
  }
}

/** 元データとサムネイルを合わせた、メディアの今の使用容量（メインアプリの `sumMediaStorageBytes` と同じ） */
async function sumMediaStorageBytes(db: AdminDb): Promise<number> {
  const [row] = await db.select({ total: TOTAL_BYTES }).from(mediaAssets);
  return Number(row?.total ?? 0);
}

/**
 * 画像を R2 に置き、`media_assets` に追加する文を返す。文を実行する前に失敗したときのため、
 * 置いたオブジェクトのキーも返す（呼び出し側が片付ける）。
 * メインアプリのアップロードと同じく、置く前に保存容量の上限を確かめ、超えるときは
 * `StorageLimitError` を投げる（管理画面の画像で上限を使い切り、利用者がアップロードできなくなるのを防ぐ）。
 * 差し替えでは、同じ batch で削除するこの商品の今の画像の分（`releasedBytes`）を差し引いた、
 * 差し替え後の使用容量で確かめる
 */
async function putImage(
  db: AdminDb,
  bucket: AdminBucket,
  productId: string,
  image: NewCatalogImage,
  storageLimitBytes: number,
  releasedBytes = 0,
) {
  if (
    (await sumMediaStorageBytes(db)) - releasedBytes + image.bytes.byteLength >
    storageLimitBytes
  ) {
    throw new StorageLimitError();
  }
  const assetId = crypto.randomUUID();
  const objectKey = `${CATALOG_FOOD_PRODUCT_MEDIA_TYPE}/${productId}/${assetId}`;
  await bucket.put(objectKey, image.bytes, {
    httpMetadata: { contentType: image.mimeType },
  });
  // 画像の行は商品を外部キーで参照しないため、同時に商品が削除されていたら追加しない
  const statement = insertWhere(
    db,
    mediaAssets,
    {
      id: assetId,
      catId: null,
      uploadedByUserId: null,
      recordType: CATALOG_FOOD_PRODUCT_MEDIA_TYPE,
      recordId: productId,
      objectKey,
      thumbnailObjectKey: null,
      mimeType: image.mimeType,
      sizeBytes: image.bytes.byteLength,
      sortOrder: 0,
    },
    exists(
      db
        .select({ id: catalogFoodProducts.id })
        .from(catalogFoodProducts)
        .where(eq(catalogFoodProducts.id, productId)),
    ),
  );
  return { objectKey, statement };
}

/** 文を実行し、失敗したら先に置いた画像を R2 から片付けて投げ直す */
async function batchWithImage<
  T extends Readonly<[BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]>,
>(
  db: AdminDb,
  bucket: AdminBucket,
  statements: T,
  uploadedKey: string | null,
): Promise<BatchResponse<T>> {
  try {
    return await db.batch(statements);
  } catch (error) {
    if (uploadedKey) {
      await bucket.delete(uploadedKey).catch(() => {});
    }
    throw error;
  }
}

/**
 * 書き込む列の値。`package_amount_g`・`package_unit` には、内容量の候補を追加する前のコード
 * （デプロイ前のメインアプリなど）のために先頭の候補を書く
 */
function valueColumns(values: CatalogFoodProductValues) {
  const [first] = values.packageSizes;
  return {
    name: values.name,
    manufacturer: values.manufacturer,
    amountUnit: values.amountUnit,
    kcalPer100g: values.kcalPer100g,
    packageAmountG: first.amountG,
    packageUnit: first.unit,
    nutritionType: values.nutritionType,
    textureType: values.textureType,
    lifeStages: values.lifeStages,
    targetBreed: values.targetBreed,
    packageSizes: values.packageSizes,
    searchKeywords: values.searchKeywords,
  };
}

/** 共通のごはん商品を登録し、ID を返す */
export async function createCatalogFoodProduct(
  db: AdminDb,
  bucket: AdminBucket,
  values: CatalogFoodProductValues,
  image: NewCatalogImage | null,
  storageLimitBytes: number,
): Promise<string> {
  const id = crypto.randomUUID();
  const insert = db
    .insert(catalogFoodProducts)
    .values({ id, ...valueColumns(values) });
  const uploaded = image
    ? await putImage(db, bucket, id, image, storageLimitBytes)
    : null;
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
 * 商品がなければ false。
 *
 * 画像は 1 商品に 1 枚。差し替えでは、先に読んだ画像の行ではなく、更新と同じ batch（トランザクション）の
 * 中でその時点の画像の行をすべて削除してから新しい行を追加する。同時に 2 つの差し替えが重なっても、
 * 後から実行された batch が先の画像の行も削除するため、画像は 1 枚だけ残る。削除した行は RETURNING で
 * 受け取り、その R2 のオブジェクトを削除する
 */
export async function updateCatalogFoodProduct(
  db: AdminDb,
  bucket: AdminBucket,
  id: string,
  values: CatalogFoodProductValues,
  options: {
    image: NewCatalogImage | null;
    removeImage: boolean;
    storageLimitBytes: number;
  },
): Promise<boolean> {
  if (!(await getCatalogFoodProduct(db, id))) {
    return false;
  }
  const update = db
    .update(catalogFoodProducts)
    .set({ ...valueColumns(values), updatedAt: sql`(unixepoch())` })
    .where(eq(catalogFoodProducts.id, id))
    .returning({ id: catalogFoodProducts.id });

  // 画像を変えないときは、商品の行だけを更新する
  if (options.image == null && !options.removeImage) {
    return (await update).length > 0;
  }

  const uploaded = options.image
    ? await putImage(
        db,
        bucket,
        id,
        options.image,
        options.storageLimitBytes,
        await sumProductImageBytes(db, id),
      )
    : null;
  const deleteImages = db
    .delete(mediaAssets)
    .where(productImagesCondition(id))
    .returning(IMAGE_COLUMNS);
  const [updated, oldImages] = await batchWithImage(
    db,
    bucket,
    uploaded
      ? [update, deleteImages, uploaded.statement]
      : [update, deleteImages],
    uploaded?.objectKey ?? null,
  );
  // 存在の確認から batch までの間に商品が削除されていたら、何も更新されていない
  // （画像の行も追加されない）ため、置いた画像を片付けて見つからなかったことにする
  if (updated.length === 0) {
    if (uploaded) {
      await bucket.delete(uploaded.objectKey).catch((error: unknown) => {
        console.error(
          "使われない画像を R2 から削除できませんでした",
          uploaded.objectKey,
          error,
        );
      });
    }
    return false;
  }

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
 * 画像の行は商品の削除と同じ batch で RETURNING 付きで削除し、同時の差し替えで後から追加された
 * 画像があれば、その R2 のオブジェクトも削除する。
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
  const [deletedImages] = await db.batch([
    db
      .delete(mediaAssets)
      .where(productImagesCondition(id))
      .returning(IMAGE_COLUMNS),
    db.delete(catalogFoodProducts).where(eq(catalogFoodProducts.id, id)),
  ]);
  // 上で読んでから batch までの間に、同時の差し替えで画像の行が追加されていたら、その画像も
  // R2 から削除する。行はもう無いため、失敗しても参照先のない行は残らない（記録して続ける）
  const addedKeys = objectKeysOf(deletedImages).filter(
    (key) => !keys.includes(key),
  );
  if (addedKeys.length > 0) {
    await bucket.delete(addedKeys).catch((error: unknown) => {
      console.error("画像を R2 から削除できませんでした", addedKeys, error);
    });
  }
  return true;
}
