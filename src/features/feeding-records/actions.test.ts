// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
} from "@/db/schema";

// `src/features/symptoms/actions.test.ts` と同様に、`getDb` をテスト用の sql.js に差し替え、
// D1 専用の `db.batch` は順番に実行するだけの簡易実装で補う
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));
// Next.js の redirect と同じく例外を投げ、以降の処理を止める
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
// 猫の家による認可はこのテストの対象外のため、常に許可する
vi.mock("@/features/auth/session", () => ({
  requireCatAccess: async () => ({}),
}));

const { deleteFeedingRecordAction } = await import("./actions");

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

  await db.insert(cats).values([
    { id: "tama", name: "たま", sex: "female" },
    { id: "kuro", name: "クロ", sex: "male" },
  ]);
  await db.insert(foodProducts).values({
    id: "food",
    name: "カリカリ",
    kcalPer100g: 380,
    packageAmountG: 500,
    nutritionType: "complete",
    textureType: "dry",
  });
  await db.insert(feedingRecords).values([
    { id: "tama-meal", catId: "tama", occurredAt: new Date() },
    { id: "kuro-meal", catId: "kuro", occurredAt: new Date() },
  ]);
  await db.insert(feedingRecordItems).values([
    { feedingRecordId: "tama-meal", foodProductId: "food", givenAmountG: 30 },
    { feedingRecordId: "kuro-meal", foodProductId: "food", givenAmountG: 40 },
  ]);
});

async function itemsOf(feedingRecordId: string) {
  return db
    .select()
    .from(feedingRecordItems)
    .where(eq(feedingRecordItems.feedingRecordId, feedingRecordId));
}

describe("deleteFeedingRecordAction", () => {
  it("記録と明細を削除する", async () => {
    await expect(
      deleteFeedingRecordAction("tama", "tama-meal"),
    ).rejects.toThrow("REDIRECT:/cats/tama/feeding-records");

    expect(await itemsOf("tama-meal")).toEqual([]);
    expect(
      await db
        .select()
        .from(feedingRecords)
        .where(eq(feedingRecords.id, "tama-meal")),
    ).toEqual([]);
  });

  it("別の猫の記録 ID を渡しても、記録も明細も削除しない", async () => {
    // 認可を通過する自分の猫（tama）の catId と、別の猫の記録 ID を組み合わせる
    await expect(
      deleteFeedingRecordAction("tama", "kuro-meal"),
    ).rejects.toThrow("REDIRECT:/cats/tama/feeding-records");

    expect(await itemsOf("kuro-meal")).toHaveLength(1);
    expect(
      await db
        .select()
        .from(feedingRecords)
        .where(eq(feedingRecords.id, "kuro-meal")),
    ).toHaveLength(1);
  });
});
