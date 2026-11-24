// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  cleaningRecords,
  cleaningTargets,
  households,
  notifications,
  users,
} from "@/db/schema";
import { createNotificationRepository } from "./notificationRepository";

let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

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
  await db.insert(users).values({ id: "user-1", name: "ユーザー1" });
  await db.insert(cats).values([
    { id: "tama", name: "たま", sex: "female" },
    { id: "sora", name: "そら", sex: "male", memorialDate: "2026-07-10" },
  ]);
  await db.insert(cleaningTargets).values([
    {
      id: "tama-toilet",
      catId: "tama",
      name: "トイレ",
      frequencyValue: 1,
      frequencyUnit: "days",
    },
    {
      id: "sora-toilet",
      catId: "sora",
      name: "トイレ",
      frequencyValue: 1,
      frequencyUnit: "days",
    },
  ]);
  await db.insert(notifications).values(
    (["tama", "sora"] as const).map((catId) => ({
      id: `${catId}-cleaning`,
      catId,
      kind: "cleaning_due" as const,
      referenceId: `${catId}-toilet`,
      dedupeKey: `${catId}-cleaning`,
      title: "トイレの掃除の日です",
      body: "",
      url: "/",
      dueAt: new Date("2026-07-01T09:00:00Z"),
      status: "dismissed" as const,
    })),
  );
});

describe("メモリーへ移した猫の通知", () => {
  it("閉じた通知を延期しても、届け直さない", async () => {
    const repository = createNotificationRepository();
    const until = new Date("2026-08-01T09:00:00Z");

    await repository.snooze("sora-cleaning", until);
    await repository.snooze("tama-cleaning", until);

    const statuses = Object.fromEntries(
      (await db.select().from(notifications)).map((row) => [
        row.id,
        row.status,
      ]),
    );
    expect(statuses).toEqual({
      "sora-cleaning": "dismissed",
      "tama-cleaning": "snoozed",
    });
  });

  it("記録できる猫のいない家の、閉じたごはんの通知を延期しても届け直さない", async () => {
    await db.insert(households).values([
      { id: "memorial-home", name: "思い出の家" },
      { id: "home", name: "わが家" },
    ]);
    await db
      .update(cats)
      .set({ householdId: "memorial-home" })
      .where(eq(cats.id, "sora"));
    await db
      .update(cats)
      .set({ householdId: "home" })
      .where(eq(cats.id, "tama"));
    await db.insert(notifications).values(
      ["memorial-home", "home"].map((householdId) => ({
        id: `${householdId}-feeding`,
        householdId,
        kind: "feeding_time" as const,
        dedupeKey: `${householdId}-feeding`,
        title: "ごはんの時間です",
        body: "",
        url: "/",
        dueAt: new Date("2026-07-01T09:00:00Z"),
        status: "dismissed" as const,
      })),
    );
    const repository = createNotificationRepository();
    const until = new Date("2026-08-01T09:00:00Z");

    await repository.snooze("memorial-home-feeding", until);
    await repository.snooze("home-feeding", until);

    const rows = await db.select().from(notifications);
    expect(rows.find((row) => row.id === "memorial-home-feeding")?.status).toBe(
      "dismissed",
    );
    expect(rows.find((row) => row.id === "home-feeding")?.status).toBe(
      "snoozed",
    );
  });

  it("掃除の通知を完了にしても、掃除の記録を追加しない", async () => {
    const repository = createNotificationRepository();
    const now = new Date("2026-08-01T09:00:00Z");

    await repository.completeWithCleaningRecord("sora-cleaning", now, {
      userId: "user-1",
      mcpClientId: null,
      apiTokenId: null,
    });
    await repository.completeWithCleaningRecord("tama-cleaning", now, {
      userId: "user-1",
      mcpClientId: null,
      apiTokenId: null,
    });

    expect(
      (await db.select().from(cleaningRecords)).map((row) => row.catId),
    ).toEqual(["tama"]);
    const [sora] = await db.select().from(cats).where(eq(cats.id, "sora"));
    expect(sora.memorialDate).toBe("2026-07-10");
  });
});
