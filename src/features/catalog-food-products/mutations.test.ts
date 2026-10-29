// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { catalogFoodProducts, mediaAssets } from "@/db/schema";
import { MEDIA_LIMIT_ENV_KEYS } from "@/features/media/limits";
import type { MediaEnv } from "@/features/media/storage";

// 共通のごはん商品の画像の差し替えを、実際のマイグレーションを適用した DB と、R2 の代わりの
// Map で確かめる。D1 専用の `db.batch` は順番に実行するだけの簡易実装で補う
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({ getDb: () => db }));

const { replaceCatalogFoodProductImage } = await import("./mutations");

const objects = new Map<string, Uint8Array>();
const bucket = {
  put: vi.fn(async (key: string, value: Uint8Array) => {
    objects.set(key, value);
  }),
  delete: vi.fn(async (keys: string | string[]) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      objects.delete(key);
    }
  }),
};
const env = { DB: {}, MEDIA_BUCKET: bucket } as unknown as MediaEnv;

const image = { bytes: new Uint8Array(100), size: 800 };

beforeEach(async () => {
  const SQL = await initSqlJs();
  const raw = drizzle(new SQL.Database());
  await migrate(raw, { migrationsFolder: "./drizzle" });
  db = raw as unknown as ReturnType<typeof getDb>;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に D1 の batch を簡易実装する
  (db as any).batch = async (statements: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement);
    }
    return results;
  };
  await db.insert(catalogFoodProducts).values({
    id: "catalog-1",
    name: "まぐろ",
    kcalPer100g: 80,
    packageAmountG: 14,
    nutritionType: "general",
    textureType: "wet",
  });
});

afterEach(() => {
  objects.clear();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("replaceCatalogFoodProductImage", () => {
  it("サムネイルを作らずに正方形の JPEG を置き、それまでの画像を消す", async () => {
    // 管理画面で登録した画像（サムネイルなし）と、サムネイルを持つ画像があるとき
    await db.insert(mediaAssets).values([
      {
        id: "old-1",
        recordType: "catalog_food_product",
        recordId: "catalog-1",
        objectKey: "catalog_food_product/catalog-1/old-1",
        mimeType: "image/jpeg",
        sizeBytes: 10,
      },
      {
        id: "old-2",
        recordType: "catalog_food_product",
        recordId: "catalog-1",
        objectKey: "catalog_food_product/catalog-1/old-2",
        thumbnailObjectKey: "catalog_food_product/catalog-1/old-2.thumb.webp",
        mimeType: "image/png",
        sizeBytes: 10,
        thumbnailSizeBytes: 5,
      },
    ]);
    for (const key of [
      "catalog_food_product/catalog-1/old-1",
      "catalog_food_product/catalog-1/old-2",
      "catalog_food_product/catalog-1/old-2.thumb.webp",
    ]) {
      objects.set(key, new Uint8Array(1));
    }

    expect(await replaceCatalogFoodProductImage("catalog-1", image, env)).toBe(
      true,
    );

    const rows = await db.select().from(mediaAssets);
    expect(rows).toEqual([
      expect.objectContaining({
        catId: null,
        uploadedByUserId: null,
        recordType: "catalog_food_product",
        recordId: "catalog-1",
        objectKey: `catalog_food_product/catalog-1/${rows[0].id}`,
        thumbnailObjectKey: null,
        mimeType: "image/jpeg",
        sizeBytes: 100,
        thumbnailSizeBytes: null,
        width: 800,
        height: 800,
        sortOrder: 0,
      }),
    ]);
    expect([...objects.keys()]).toEqual([rows[0].objectKey]);
    expect(bucket.put).toHaveBeenCalledWith(rows[0].objectKey, image.bytes, {
      httpMetadata: { contentType: "image/jpeg" },
    });
  });

  it("商品がなければ行を追加せず、置いた画像も消す", async () => {
    expect(await replaceCatalogFoodProductImage("missing", image, env)).toBe(
      false,
    );

    expect(await db.select().from(mediaAssets)).toEqual([]);
    expect(objects.size).toBe(0);
  });

  it("保存容量の上限は、差し替える画像の分を差し引いて確かめる", async () => {
    vi.stubEnv(MEDIA_LIMIT_ENV_KEYS.storageLimitBytes, "150");
    await db.insert(mediaAssets).values({
      id: "old-1",
      recordType: "catalog_food_product",
      recordId: "catalog-1",
      objectKey: "catalog_food_product/catalog-1/old-1",
      mimeType: "image/jpeg",
      sizeBytes: 100,
    });

    // 今の画像（100）を差し引けば、新しい画像（100）は上限（150）に収まる
    expect(await replaceCatalogFoodProductImage("catalog-1", image, env)).toBe(
      true,
    );

    // ほかの記録の画像（60）と合わせると上限を超える
    await db.insert(mediaAssets).values({
      id: "other",
      recordType: "poop",
      recordId: "record-1",
      objectKey: "poop/record-1/other",
      mimeType: "image/jpeg",
      sizeBytes: 60,
    });
    await expect(
      replaceCatalogFoodProductImage("catalog-1", image, env),
    ).rejects.toThrow("保存容量の上限");
    expect(bucket.put).toHaveBeenCalledTimes(1);
  });
});
