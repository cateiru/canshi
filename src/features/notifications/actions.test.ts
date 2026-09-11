// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  notifications,
  pushDeliveries,
  pushSubscriptions,
} from "@/db/schema";

// sql.js は D1 と同じ SQLite 方言のテスト用スタブだが `db.batch`（D1 専用）を持たないため、
// 順番に実行するだけの簡易実装をこのテストで補う。`queries.test.ts` と同様に
// `@/db/client` の `getDb` 自体をこのテスト用の db に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const { snoozeNotificationAction } = await import("./actions");

describe("snoozeNotificationAction", () => {
  beforeAll(async () => {
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
  });

  it("延期すると status・snoozedUntil を更新し、readAt・pushedAt と push_deliveries の記録をリセットする", async () => {
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
        // 表示済み・Push送信済みの状態から延期する
        readAt: new Date(),
        pushedAt: new Date(),
      })
      .returning();
    const [subscription] = await db
      .insert(pushSubscriptions)
      .values({
        endpoint: `https://push.example.com/${crypto.randomUUID()}`,
        p256dh: "p256dh-key",
        auth: "auth-secret",
      })
      .returning();
    // 延期前に1回送信済みだったという記録
    await db.insert(pushDeliveries).values({
      notificationId: notification.id,
      subscriptionId: subscription.id,
    });

    const snoozedUntil = new Date("2026-09-20T00:00:00.000Z");
    const result = await snoozeNotificationAction(
      notification.id,
      snoozedUntil,
    );

    expect(result).toEqual({});

    const [updated] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notification.id));
    expect(updated.status).toBe("snoozed");
    expect(updated.snoozedUntil).toEqual(snoozedUntil);
    expect(updated.readAt).toBeNull();
    expect(updated.pushedAt).toBeNull();

    // push_deliveries の記録が残っていると、期日到来後も Workflow がこの購読への
    // 送信を「済み」と判断して再送しない（src/workflows/notification.ts の `delivered` 参照）
    const deliveries = await db
      .select()
      .from(pushDeliveries)
      .where(eq(pushDeliveries.notificationId, notification.id));
    expect(deliveries).toHaveLength(0);
  });
});
