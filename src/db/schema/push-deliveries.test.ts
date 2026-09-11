// @vitest-environment node
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { notifications } from "./notifications";
import { pushDeliveries } from "./push-deliveries";
import { pushSubscriptions } from "./push-subscriptions";

describe("push_deliveries テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
    // sql.js は既定で外部キー制約を検証しない（D1 は検証する）ため、
    // ON DELETE cascade の挙動を確かめるテストのために明示的に有効化する
    db.run(sql`PRAGMA foreign_keys = ON`);
  });

  async function insertNotificationAndSubscription() {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();
    const [notification] = await db
      .insert(notifications)
      .values({
        catId: cat.id,
        kind: "birthday_yearly",
        dedupeKey: `dedupe-${crypto.randomUUID()}`,
        title: "たまのお誕生日",
        body: "今日は1歳の誕生日です",
        url: `/cats/${cat.id}`,
        dueAt: new Date(),
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
    return { notification, subscription };
  }

  it("insert / select できる", async () => {
    const { notification, subscription } =
      await insertNotificationAndSubscription();

    await db.insert(pushDeliveries).values({
      notificationId: notification.id,
      subscriptionId: subscription.id,
    });

    const rows = await db.select().from(pushDeliveries);
    expect(rows).toHaveLength(1);
  });

  it("同じ notification_id・subscription_id の組は重複して insert できない", async () => {
    const { notification, subscription } =
      await insertNotificationAndSubscription();

    await db.insert(pushDeliveries).values({
      notificationId: notification.id,
      subscriptionId: subscription.id,
    });

    await expect(
      db.insert(pushDeliveries).values({
        notificationId: notification.id,
        subscriptionId: subscription.id,
      }),
    ).rejects.toThrow();
  });

  it("購読を削除すると、その購読への送信記録も一緒に削除される（送信成功済みの端末でも削除できる）", async () => {
    const { notification, subscription } =
      await insertNotificationAndSubscription();
    await db.insert(pushDeliveries).values({
      notificationId: notification.id,
      subscriptionId: subscription.id,
    });

    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscription.id));

    const rows = await db
      .select()
      .from(pushDeliveries)
      .where(eq(pushDeliveries.subscriptionId, subscription.id));
    expect(rows).toHaveLength(0);
  });

  it("通知を削除すると、その通知の送信記録も一緒に削除される", async () => {
    const { notification, subscription } =
      await insertNotificationAndSubscription();
    await db.insert(pushDeliveries).values({
      notificationId: notification.id,
      subscriptionId: subscription.id,
    });

    await db.delete(notifications).where(eq(notifications.id, notification.id));

    const rows = await db
      .select()
      .from(pushDeliveries)
      .where(eq(pushDeliveries.notificationId, notification.id));
    expect(rows).toHaveLength(0);
  });
});
