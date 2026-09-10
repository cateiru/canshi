// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { mediaAssets } from "./media-assets";

describe("media_assets テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("猫に紐付くメディアと紐付かないメディアの両方を保存できる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning({ id: cats.id });

    await db.insert(mediaAssets).values([
      {
        catId: cat.id,
        recordType: "poop_record",
        recordId: "rec-1",
        objectKey: "poop_record/rec-1/a",
        thumbnailObjectKey: "poop_record/rec-1/a.thumb.webp",
        mimeType: "image/jpeg",
        sizeBytes: 1000,
        thumbnailSizeBytes: 100,
        width: 640,
        height: 480,
        sortOrder: 1,
      },
      {
        catId: null,
        recordType: "food_product",
        recordId: "prod-1",
        objectKey: "food_product/prod-1/b",
        mimeType: "image/png",
      },
    ]);

    const rows = await db.select().from(mediaAssets);

    expect(rows).toHaveLength(2);
    const poop = rows.find((row) => row.recordType === "poop_record");
    expect(poop?.catId).toBe(cat.id);
    expect(poop?.sizeBytes).toBe(1000);
    expect(poop?.width).toBe(640);
    expect(poop?.sortOrder).toBe(1);
    const food = rows.find((row) => row.recordType === "food_product");
    expect(food?.catId).toBeNull();
    // 追加カラムの既定値
    expect(food?.sizeBytes).toBe(0);
    expect(food?.thumbnailSizeBytes).toBeNull();
    expect(food?.sortOrder).toBe(0);
  });
});
