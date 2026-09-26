// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  cleaningRecords,
  cleaningTargets,
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

const { markCleaningNotificationDoneAction, snoozeNotificationAction } =
  await import("./actions");

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

describe("snoozeNotificationAction", () => {
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

describe("markCleaningNotificationDoneAction", () => {
  async function setup(targetValues: { isActive?: boolean } = {}) {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();
    const [target] = await db
      .insert(cleaningTargets)
      .values({
        catId: cat.id,
        name: "トイレ",
        frequencyValue: 1,
        ...targetValues,
      })
      .returning();
    const [notification] = await db
      .insert(notifications)
      .values({
        catId: cat.id,
        kind: "cleaning_due",
        referenceId: target.id,
        dedupeKey: `dedupe-${crypto.randomUUID()}`,
        title: "トイレのお手入れの時期です",
        body: "たまのトイレが予定日を迎えました",
        url: `/cats/${cat.id}/cleaning/targets/${target.id}/records`,
        dueAt: new Date(),
      })
      .returning();
    return { cat, target, notification };
  }

  async function findNotification(id: string) {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));
    return notification;
  }

  async function findRecords(targetId: string) {
    return db
      .select()
      .from(cleaningRecords)
      .where(eq(cleaningRecords.cleaningTargetId, targetId));
  }

  it("通知を完了にし、掃除対象に今の時刻の記録を追加する", async () => {
    const { cat, target, notification } = await setup();

    const result = await markCleaningNotificationDoneAction(notification.id);

    expect(result).toEqual({});
    expect((await findNotification(notification.id)).status).toBe("done");
    const records = await findRecords(target.id);
    expect(records).toHaveLength(1);
    expect(records[0].catId).toBe(cat.id);
    expect(records[0].memo).toBeNull();
  });

  it("完了済みの通知に対しては記録を追加しない", async () => {
    const { target, notification } = await setup();

    await markCleaningNotificationDoneAction(notification.id);
    const result = await markCleaningNotificationDoneAction(notification.id);

    expect(result).toEqual({});
    expect(await findRecords(target.id)).toHaveLength(1);
  });

  it("掃除対象が無効化されていればエラーを返し、通知も完了にしない", async () => {
    const { target, notification } = await setup({ isActive: false });

    const result = await markCleaningNotificationDoneAction(notification.id);

    expect(result).toEqual({ error: "掃除対象が見つかりませんでした" });
    expect((await findNotification(notification.id)).status).toBe("pending");
    expect(await findRecords(target.id)).toHaveLength(0);
  });

  it("掃除以外の通知にはエラーを返す", async () => {
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
      })
      .returning();

    const result = await markCleaningNotificationDoneAction(notification.id);

    expect(result).toEqual({ error: "通知が見つかりませんでした" });
    expect((await findNotification(notification.id)).status).toBe("pending");
  });
});
