// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { D1_MAX_BOUND_PARAMETERS } from "@/db/batch";
import type { getDb } from "@/db/client";
import {
  cats,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
} from "@/db/schema";
import { listFeedingRecords } from "./queries";

let db: ReturnType<typeof getDb>;
let sqlite: InstanceType<Awaited<ReturnType<typeof initSqlJs>>["Database"]>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

describe("listFeedingRecords", () => {
  beforeAll(async () => {
    const SQL = await initSqlJs();
    sqlite = new SQL.Database();
    db = drizzle(sqlite) as unknown as ReturnType<typeof getDb>;
    await migrate(db as unknown as ReturnType<typeof drizzle>, {
      migrationsFolder: "./drizzle",
    });
  });

  it("記録が多くても、明細を D1 のバインドパラメーターの上限内で取得する", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "くろ", sex: "male" })
      .returning();
    const [dry, wet] = await db
      .insert(foodProducts)
      .values([
        {
          name: "カリカリ",
          kcalPer100g: 380,
          packageAmountG: 500,
          nutritionType: "complete",
          textureType: "dry",
        },
        {
          name: "パウチ",
          kcalPer100g: 80,
          packageAmountG: 70,
          nutritionType: "complete",
          textureType: "wet",
        },
      ])
      .returning();
    // 1 日 2 回ずつ 125 日分（250 件）記録する
    const meals = Array.from({ length: 250 }, (_, index) => ({
      id: `meal-${String(index).padStart(3, "0")}`,
      catId: cat.id,
      occurredAt: new Date(
        Date.UTC(2026, 0, 1 + Math.floor(index / 2), index % 2 === 0 ? 8 : 20),
      ),
    }));
    for (let index = 0; index < meals.length; index += 25) {
      const rows = meals.slice(index, index + 25);
      await db.insert(feedingRecords).values(rows);
      // 明細の並び順を確かめるため、sortOrder と挿入順を逆にする
      await db.insert(feedingRecordItems).values(
        rows.flatMap((meal) => [
          {
            feedingRecordId: meal.id,
            foodProductId: wet.id,
            givenAmountG: 40,
            sortOrder: 1,
          },
          {
            feedingRecordId: meal.id,
            foodProductId: dry.id,
            givenAmountG: 20,
            sortOrder: 0,
          },
        ]),
      );
    }

    // D1 と同じく、1 クエリのバインドパラメーターが上限を超えたら失敗させる
    const original = db;
    db = drizzle(sqlite, {
      logger: {
        logQuery: (_query, params) => {
          expect(params.length).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMETERS);
        },
      },
    }) as unknown as ReturnType<typeof getDb>;
    try {
      const records = await listFeedingRecords(cat.id);

      expect(records).toHaveLength(250);
      expect(records[0].id).toBe("meal-249");
      expect(records.at(-1)?.id).toBe("meal-000");
      for (const record of records) {
        expect(record.items.map((item) => item.foodProductName)).toEqual([
          "カリカリ",
          "パウチ",
        ]);
      }
    } finally {
      db = original;
    }
  });
});
