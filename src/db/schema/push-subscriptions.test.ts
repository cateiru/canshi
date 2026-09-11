// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { pushSubscriptions } from "./push-subscriptions";

describe("push_subscriptions テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("insert / select でき、failure_count は 0 が既定値になる", async () => {
    await db.insert(pushSubscriptions).values({
      endpoint: "https://push.example.com/subscription-1",
      p256dh: "p256dh-key",
      auth: "auth-secret",
    });

    const rows = await db.select().from(pushSubscriptions);

    expect(rows).toHaveLength(1);
    expect(rows[0].failureCount).toBe(0);
    expect(rows[0].userAgent).toBeNull();
    expect(rows[0].lastUsedAt).toBeNull();
  });

  it("同じ endpoint は重複して insert できない", async () => {
    await db.insert(pushSubscriptions).values({
      endpoint: "https://push.example.com/subscription-2",
      p256dh: "p256dh-key",
      auth: "auth-secret",
    });

    await expect(
      db.insert(pushSubscriptions).values({
        endpoint: "https://push.example.com/subscription-2",
        p256dh: "other-key",
        auth: "other-secret",
      }),
    ).rejects.toThrow();
  });
});
