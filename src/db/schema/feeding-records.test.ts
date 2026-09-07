// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { feedingRecordItems, feedingRecords } from "./feeding-records";
import { foodProducts } from "./food-products";

describe("feeding_records / feeding_record_items テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("cat への参照つきで記録ヘッダーを型安全に insert / select できる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();

    const [feedingRecord] = await db
      .insert(feedingRecords)
      .values({
        catId: cat.id,
        occurredAt: new Date("2026-09-07T08:00:00.000Z"),
      })
      .returning();

    const rows = await db.select().from(feedingRecords);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(feedingRecord.id);
    expect(rows[0].catId).toBe(cat.id);
  });

  it("複数商品を明細として insert / select できる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "みけ", sex: "male" })
      .returning();
    const [wetFood] = await db
      .insert(foodProducts)
      .values({
        name: "ウェットNg",
        kcalPer100g: 90,
        packageAmountG: 85,
        nutritionType: "complete",
        textureType: "wet",
      })
      .returning();
    const [dryFood] = await db
      .insert(foodProducts)
      .values({
        name: "カリカリNg",
        kcalPer100g: 380,
        packageAmountG: 1500,
        nutritionType: "complete",
        textureType: "dry",
      })
      .returning();

    const [feedingRecord] = await db
      .insert(feedingRecords)
      .values({
        catId: cat.id,
        occurredAt: new Date("2026-09-07T08:00:00.000Z"),
      })
      .returning();

    await db.insert(feedingRecordItems).values([
      {
        feedingRecordId: feedingRecord.id,
        foodProductId: wetFood.id,
        givenAmountG: 40,
        leftoverAmountG: 0,
        estimatedIntakeG: 40,
        estimatedKcal: 36,
        sortOrder: 0,
      },
      {
        feedingRecordId: feedingRecord.id,
        foodProductId: dryFood.id,
        givenAmountG: 20,
        leftoverAmountG: 5,
        estimatedIntakeG: 15,
        estimatedKcal: 57,
        sortOrder: 1,
      },
    ]);

    const items = await db
      .select()
      .from(feedingRecordItems)
      .where(eq(feedingRecordItems.feedingRecordId, feedingRecord.id));

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.foodProductId).sort()).toEqual(
      [wetFood.id, dryFood.id].sort(),
    );
  });
});
