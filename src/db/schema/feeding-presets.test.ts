// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { feedingPresetItems, feedingPresets } from "./feeding-presets";
import { foodProducts } from "./food-products";

describe("feeding_presets / feeding_preset_items テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("複数商品を明細として持つプリセットを型安全に insert / select できる", async () => {
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

    const [preset] = await db
      .insert(feedingPresets)
      .values({ name: "朝ごはんセット" })
      .returning();

    await db.insert(feedingPresetItems).values([
      {
        presetId: preset.id,
        foodProductId: wetFood.id,
        givenAmountG: 40,
        sortOrder: 0,
      },
      {
        presetId: preset.id,
        foodProductId: dryFood.id,
        givenAmountG: 20,
        sortOrder: 1,
      },
    ]);

    const items = await db
      .select()
      .from(feedingPresetItems)
      .where(eq(feedingPresetItems.presetId, preset.id));

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.foodProductId).sort()).toEqual(
      [wetFood.id, dryFood.id].sort(),
    );
  });
});
