// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
  households,
  notifications,
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
// 猫の家による認可はこのテストの対象外のため、常に許可して猫をそのまま返す
vi.mock("@/features/auth/session", () => ({
  requireCatAccess: async (catId: string) => {
    const [cat] = await db.select().from(cats).where(eq(cats.id, catId));
    return { cat };
  },
}));

const { createFeedingRecordAction, deleteFeedingRecordAction } = await import(
  "./actions"
);

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

describe("createFeedingRecordAction", () => {
  beforeEach(async () => {
    // 日本時間 2026-09-21 07:30
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-20T22:30:00.000Z"));
    await db.insert(households).values({ id: "home", name: "おうち" });
    await db.update(cats).set({ householdId: "home" });
    await db.update(foodProducts).set({ householdId: "home" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function strictForm(occurredTime = "07:30") {
    const formData = new FormData();
    formData.set("occurredDate", "2026-09-21");
    formData.set("occurredTime", occurredTime);
    formData.set("mode", "strict");
    formData.set("items.0.foodProductId", "food");
    formData.set("items.0.givenAmountG", "30");
    formData.set("items.0.leftoverAmountG", "0");
    return formData;
  }

  async function addNotification(
    id: string,
    target: { catId: string } | { householdId: string },
    kind: "feeding_time" | "feeding_not_recorded" | "weight_measurement",
    status: "pending" | "snoozed" | "dismissed" = "pending",
  ) {
    await db.insert(notifications).values({
      id,
      ...target,
      kind,
      dedupeKey: id,
      title: "タイトル",
      body: "本文",
      url: "/",
      dueAt: new Date("2026-09-21T07:00:00.000Z"),
      status,
    });
  }

  async function statusOf(id: string) {
    const [row] = await db
      .select({ status: notifications.status })
      .from(notifications)
      .where(eq(notifications.id, id));
    return row.status;
  }

  it("記録した猫の家の未対応のごはんの通知だけを完了にする", async () => {
    await db.insert(households).values({ id: "next-door", name: "となり" });
    const home = { householdId: "home" };
    await addNotification("time", home, "feeding_time");
    await addNotification("reminder", home, "feeding_not_recorded", "snoozed");
    await addNotification("dismissed", home, "feeding_time", "dismissed");
    await addNotification("weight", { catId: "tama" }, "weight_measurement");
    await addNotification(
      "other-household",
      { householdId: "next-door" },
      "feeding_time",
    );

    const result = await createFeedingRecordAction("tama", {}, strictForm());
    expect(result).toEqual({ redirectTo: "/cats/tama/feeding-records" });

    expect(await statusOf("time")).toBe("done");
    expect(await statusOf("reminder")).toBe("done");
    // 対応済みの通知・ほかの種類の通知・ほかの家の通知はそのまま
    expect(await statusOf("dismissed")).toBe("dismissed");
    expect(await statusOf("weight")).toBe("pending");
    expect(await statusOf("other-household")).toBe("pending");
  });

  it("先の日時で入力した記録では、ごはんの通知を完了にしない", async () => {
    await addNotification("time", { householdId: "home" }, "feeding_time");

    // 日本時間 07:30 に、08:00 の記録を入力する
    const result = await createFeedingRecordAction(
      "tama",
      {},
      strictForm("08:00"),
    );
    expect(result).toEqual({ redirectTo: "/cats/tama/feeding-records" });

    expect(await statusOf("time")).toBe("pending");
  });
});
