// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  householdMembers,
  households,
  notifications,
  users,
} from "@/db/schema";
import {
  countUnreadNotifications,
  listPendingNotifications,
  listResolvedNotifications,
} from "./queries";

// sql.js は D1 と同じ SQLite 方言のテスト用スタブだが、`getDb` は D1Database（`.prepare` を
// 持つ）を要求するため、drizzle でラップ済みの sql.js インスタンスをそのまま渡せない。
// そのため `queries.ts` が呼ぶ `getDb` 自体をこのテスト用の db に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

/**
 * 延期（`snoozeNotificationAction`）は `status: "snoozed"`・`snoozedUntil` を設定し、
 * `readAt`・`pushedAt` を null に戻す（`src/features/notifications/actions.ts` 参照）。
 * この状態遷移が、期日到来の前後で「未対応一覧から消える／到来後に再び未対応・未読として
 * 扱われる」という受け入れ条件を満たすことを、`now` を制御して検証する
 * （PR #41・#35 レビュー対応）
 */
describe("延期した通知の期日到来による再表示（時刻を制御した結合テスト）", () => {
  const userId = "user-1";

  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
    await migrate(db as unknown as ReturnType<typeof drizzle>, {
      migrationsFolder: "./drizzle",
    });
    await db.insert(users).values({ id: userId, name: "管理者" });
    await db.insert(households).values({ id: "household-1", name: "わが家" });
    await db
      .insert(householdMembers)
      .values({ householdId: "household-1", userId });
  });

  async function insertSnoozedNotification(snoozedUntil: Date) {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female", householdId: "household-1" })
      .returning();
    const [notification] = await db
      .insert(notifications)
      .values({
        catId: cat.id,
        kind: "weight_measurement",
        dedupeKey: `dedupe-${crypto.randomUUID()}`,
        title: "たまの体重測定のお願い",
        body: "そろそろ体重を測りましょう",
        url: `/cats/${cat.id}`,
        dueAt: new Date(),
        status: "snoozed",
        snoozedUntil,
        // snoozeNotificationAction が延期時にリセットするのと同じ状態
        readAt: null,
        pushedAt: null,
      })
      .returning();
    return notification;
  }

  it("延期期日より前は未対応一覧に含まれない", async () => {
    const snoozedUntil = new Date("2026-09-20T00:00:00.000Z");
    const notification = await insertSnoozedNotification(snoozedUntil);
    const before = new Date("2026-09-19T23:59:59.000Z");

    const pending = await listPendingNotifications(before, { userId });
    expect(pending.some((n) => n.id === notification.id)).toBe(false);
  });

  it("延期期日の到来後は未対応一覧に再び現れ、未読としてカウントされる", async () => {
    const snoozedUntil = new Date("2026-09-21T00:00:00.000Z");
    const notification = await insertSnoozedNotification(snoozedUntil);
    const after = new Date("2026-09-21T00:00:01.000Z");

    const pending = await listPendingNotifications(after, { userId });
    expect(pending.some((n) => n.id === notification.id)).toBe(true);

    const unreadCount = await countUnreadNotifications(after, userId);
    expect(unreadCount).toBeGreaterThanOrEqual(1);
  });

  it("延期中は対応済み一覧（done／dismissed）にも現れない", async () => {
    const snoozedUntil = new Date("2026-09-22T00:00:00.000Z");
    const notification = await insertSnoozedNotification(snoozedUntil);

    const resolved = await listResolvedNotifications({ userId });
    expect(resolved.some((n) => n.id === notification.id)).toBe(false);
  });
});

describe("通知の家による絞り込み", () => {
  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
    await migrate(db as unknown as ReturnType<typeof drizzle>, {
      migrationsFolder: "./drizzle",
    });
    await db.insert(users).values([
      { id: "user-a", name: "A" },
      { id: "user-b", name: "B" },
    ]);
    await db.insert(households).values([
      { id: "household-a", name: "A の家" },
      { id: "household-b", name: "B の家" },
    ]);
    await db.insert(householdMembers).values([
      { householdId: "household-a", userId: "user-a" },
      { householdId: "household-b", userId: "user-b" },
    ]);
    await db.insert(cats).values([
      { id: "cat-a", name: "たま", sex: "female", householdId: "household-a" },
      { id: "cat-b", name: "ミケ", sex: "female", householdId: "household-b" },
      // 家に紐付けていない猫の通知は誰にも見えない
      { id: "cat-orphan", name: "クロ", sex: "male" },
    ]);
    await db.insert(notifications).values(
      ["cat-a", "cat-b", "cat-orphan"].map((catId) => ({
        catId,
        kind: "weight_measurement" as const,
        dedupeKey: `dedupe-${catId}`,
        title: "体重測定のお願い",
        body: "そろそろ体重を測りましょう",
        url: `/cats/${catId}`,
        dueAt: new Date("2026-09-01T00:00:00.000Z"),
      })),
    );
  });

  const now = new Date("2026-09-02T00:00:00.000Z");

  it("所属する家の猫の通知だけを返す", async () => {
    const pending = await listPendingNotifications(now, { userId: "user-a" });
    expect(pending.map((n) => n.catId)).toEqual(["cat-a"]);
    expect(await countUnreadNotifications(now, "user-a")).toBe(1);
  });

  it("別の家の猫で絞り込んでも通知は返さない", async () => {
    const pending = await listPendingNotifications(now, {
      userId: "user-a",
      catId: "cat-b",
    });
    expect(pending).toEqual([]);
  });
});
