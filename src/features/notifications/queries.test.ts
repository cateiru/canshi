// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { cats, notifications } from "@/db/schema";
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
  beforeAll(async () => {
    const SQL = await initSqlJs();
    db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
    await migrate(db as unknown as ReturnType<typeof drizzle>, {
      migrationsFolder: "./drizzle",
    });
  });

  async function insertSnoozedNotification(snoozedUntil: Date) {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
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

    const pending = await listPendingNotifications(before);
    expect(pending.some((n) => n.id === notification.id)).toBe(false);
  });

  it("延期期日の到来後は未対応一覧に再び現れ、未読としてカウントされる", async () => {
    const snoozedUntil = new Date("2026-09-21T00:00:00.000Z");
    const notification = await insertSnoozedNotification(snoozedUntil);
    const after = new Date("2026-09-21T00:00:01.000Z");

    const pending = await listPendingNotifications(after);
    expect(pending.some((n) => n.id === notification.id)).toBe(true);

    const unreadCount = await countUnreadNotifications(after);
    expect(unreadCount).toBeGreaterThanOrEqual(1);
  });

  it("延期中は対応済み一覧（done／dismissed）にも現れない", async () => {
    const snoozedUntil = new Date("2026-09-22T00:00:00.000Z");
    const notification = await insertSnoozedNotification(snoozedUntil);

    const resolved = await listResolvedNotifications();
    expect(resolved.some((n) => n.id === notification.id)).toBe(false);
  });
});
