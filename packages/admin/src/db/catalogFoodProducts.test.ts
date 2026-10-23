import { beforeEach, describe, expect, it } from "vitest";
import { createMigratedDatabase, toAdminDb } from "../test/d1";
import { createJpeg } from "../test/jpeg";
import { createFakeBucket } from "../test/r2";
import {
  type AdminBucket,
  createCatalogFoodProduct,
  deleteCatalogFoodProduct,
  updateCatalogFoodProduct,
} from "./catalogFoodProducts";
import type { AdminDb } from "./queries";

// 共通のごはん商品の画像の更新と削除が同時に行われたときに、行・R2 のオブジェクトが孤立しないことを確かめる。
// `beforeBatch` で、存在の確認などを終えてから batch を実行するまでの間に起きた変更を差し込む
const VALUES = {
  name: "まぐろ",
  manufacturer: null,
  kcalPer100g: 380,
  packageSizes: [{ amountG: 500, unit: null }],
  nutritionType: "complete" as const,
  textureType: "dry" as const,
  lifeStages: [],
  targetBreed: null,
  searchKeywords: [],
};
const IMAGE = { bytes: createJpeg(100, 100), mimeType: "image/jpeg" as const };
const LIMIT = 1024 * 1024;

let db: AdminDb;
let fake: ReturnType<typeof createFakeBucket>;
let bucket: AdminBucket;
let beforeBatch: (() => Promise<void>) | undefined;

beforeEach(async () => {
  const raw = toAdminDb(await createMigratedDatabase());
  beforeBatch = undefined;
  db = {
    prepare: raw.prepare.bind(raw),
    batch: (async (statements: D1PreparedStatement[]) => {
      const hook = beforeBatch;
      beforeBatch = undefined;
      await hook?.();
      return raw.batch(statements);
    }) as AdminDb["batch"],
  };
  fake = createFakeBucket();
  bucket = fake.bucket;
});

async function countImages(productId: string) {
  const { results } = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM media_assets WHERE record_type = 'catalog_food_product' AND record_id = ?1",
    )
    .bind(productId)
    .all<{ count: number }>();
  return results[0].count;
}

describe("更新と削除が重なったとき", () => {
  it("差し替えの途中で商品が削除されたら、画像の行を追加せず、置いた画像も片付ける", async () => {
    const id = await createCatalogFoodProduct(db, bucket, VALUES, null, LIMIT);
    beforeBatch = async () => {
      await deleteCatalogFoodProduct(db, bucket, id);
    };
    expect(
      await updateCatalogFoodProduct(db, bucket, id, VALUES, {
        image: IMAGE,
        removeImage: false,
        storageLimitBytes: LIMIT,
      }),
    ).toBe(false);
    expect(await countImages(id)).toBe(0);
    expect(fake.objects.size).toBe(0);
  });

  it("削除の途中で差し替えの画像が追加されていたら、その画像も R2 から削除する", async () => {
    const id = await createCatalogFoodProduct(db, bucket, VALUES, IMAGE, LIMIT);
    beforeBatch = async () => {
      await updateCatalogFoodProduct(db, bucket, id, VALUES, {
        image: IMAGE,
        removeImage: false,
        storageLimitBytes: LIMIT,
      });
    };
    expect(await deleteCatalogFoodProduct(db, bucket, id)).toBe(true);
    expect(await countImages(id)).toBe(0);
    expect(fake.objects.size).toBe(0);
  });
});
