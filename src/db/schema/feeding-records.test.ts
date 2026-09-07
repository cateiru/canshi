// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { feedingRecords } from "./feeding-records";
import { foodProducts } from "./food-products";

describe("feeding_records テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("cat・商品への参照つきで型安全に insert / select できる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();
    const [foodProduct] = await db
      .insert(foodProducts)
      .values({
        name: "モンプチ",
        kcalPer100g: 380,
        packageAmountG: 1500,
        nutritionType: "complete",
        textureType: "dry",
      })
      .returning();

    await db.insert(feedingRecords).values({
      catId: cat.id,
      foodProductId: foodProduct.id,
      occurredAt: new Date("2026-09-07T08:00:00.000Z"),
      givenAmountG: 30,
      leftoverAmountG: 5,
      estimatedIntakeG: 25,
      estimatedKcal: 95,
    });

    const rows = await db.select().from(feedingRecords);

    expect(rows).toHaveLength(1);
    expect(rows[0].catId).toBe(cat.id);
    expect(rows[0].foodProductId).toBe(foodProduct.id);
    expect(rows[0].estimatedIntakeG).toBe(25);
    expect(rows[0].estimatedKcal).toBe(95);
  });
});
