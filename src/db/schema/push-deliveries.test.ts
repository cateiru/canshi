// @vitest-environment node
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
});
