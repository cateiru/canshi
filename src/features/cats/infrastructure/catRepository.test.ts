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
  householdMembers,
  households,
  users,
} from "@/db/schema";
import { createCatRepository } from "./catRepository";

// `src/features/households/application/management.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

beforeEach(async () => {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  db = drizzle(sqlite) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
  // D1 と同じく外部キー制約を有効にし、参照されたままの行を消すと失敗させる
  sqlite.run("PRAGMA foreign_keys = ON");
  // sql.js は `db.batch`（D1 専用）を持たないため、順番に実行するだけの簡易実装で補う
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に D1 の batch を簡易実装する
  (db as any).batch = async (statements: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement);
    }
    return results;
  };
  await db.insert(users).values({ id: "owner", name: "オーナー" });
  await db.insert(households).values({ id: "home", name: "わが家" });
  await db
    .insert(householdMembers)
    .values({ householdId: "home", userId: "owner", role: "owner" });
  await db.insert(cats).values([
    { id: "tama", name: "たま", sex: "female", householdId: "home" },
    { id: "kuro", name: "くろ", sex: "male", householdId: "home" },
  ]);
  await db.insert(foodProducts).values({
    id: "food",
    householdId: "home",
    name: "カリカリ",
    kcalPer100g: 380,
    packageAmountG: 500,
    nutritionType: "complete",
    textureType: "dry",
  });
  await db.insert(feedingRecords).values([
    {
      id: "tama-meal",
      catId: "tama",
      occurredAt: new Date("2026-07-01T08:00:00Z"),
    },
    {
      id: "tama-deleted-meal",
      catId: "tama",
      occurredAt: new Date("2026-07-01T20:00:00Z"),
      deletedAt: new Date("2026-07-02T00:00:00Z"),
    },
    {
      id: "kuro-meal",
      catId: "kuro",
      occurredAt: new Date("2026-07-01T08:00:00Z"),
    },
  ]);
  await db.insert(feedingRecordItems).values([
    { feedingRecordId: "tama-meal", foodProductId: "food", givenAmountG: 30 },
    {
      feedingRecordId: "tama-deleted-meal",
      foodProductId: "food",
      givenAmountG: 20,
    },
    { feedingRecordId: "kuro-meal", foodProductId: "food", givenAmountG: 25 },
  ]);
});

describe("removeForUser", () => {
  it("ごはん記録（論理削除したものも含む）を明細ごと物理削除して、猫を削除する", async () => {
    await createCatRepository().removeForUser("owner", "tama");

    expect(await db.select().from(cats).where(eq(cats.id, "tama"))).toEqual([]);
    expect(
      (await db.select().from(feedingRecords)).map((record) => record.id),
    ).toEqual(["kuro-meal"]);
    // 別の猫の記録の明細は残す
    expect(
      (await db.select().from(feedingRecordItems)).map(
        (item) => item.feedingRecordId,
      ),
    ).toEqual(["kuro-meal"]);
  });
});
