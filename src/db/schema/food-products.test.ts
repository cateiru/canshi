// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { foodProducts } from "./food-products";

describe("food_products テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("型安全に insert / select できる", async () => {
    await db.insert(foodProducts).values({
      name: "モンプチ",
      kcalPer100g: 380,
      packageAmountG: 1500,
      nutritionType: "complete",
      textureType: "dry",
    });

    const rows = await db.select().from(foodProducts);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("モンプチ");
    expect(rows[0].kcalPer100g).toBe(380);
    expect(rows[0].nutritionType).toBe("complete");
    expect(rows[0].id).toEqual(expect.any(String));
    // 単位を指定しない既存の商品は、商品全体の内容量として NULL のまま
    expect(rows[0].packageUnit).toBeNull();
    // 追加の項目を指定しない既存の商品は未設定のまま
    expect(rows[0].manufacturer).toBeNull();
    expect(rows[0].lifeStages).toEqual([]);
    expect(rows[0].targetBreed).toBeNull();
  });

  it("対象の猫は JSON 配列として保存・取得できる", async () => {
    const [created] = await db
      .insert(foodProducts)
      .values({
        name: "スープ",
        manufacturer: "いなば",
        kcalPer100g: 20,
        packageAmountG: 40,
        nutritionType: "general",
        textureType: "soup",
        lifeStages: ["adult", "senior"],
        targetBreed: "ペルシャ",
      })
      .returning();

    expect(created.textureType).toBe("soup");
    expect(created.lifeStages).toEqual(["adult", "senior"]);
    expect(created.targetBreed).toBe("ペルシャ");
  });
});
