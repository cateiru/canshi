// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { notificationPreferences } from "./notification-preferences";

describe("notification_preferences テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("id・notify_time・timezone を省略すると既定値（default・09:00・Asia/Tokyo）になる", async () => {
    await db.insert(notificationPreferences).values({});

    const rows = await db.select().from(notificationPreferences);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("default");
    expect(rows[0].notifyTime).toBe("09:00");
    expect(rows[0].timezone).toBe("Asia/Tokyo");
  });
});
