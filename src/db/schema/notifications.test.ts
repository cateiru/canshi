// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { notifications } from "./notifications";

describe("notifications テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("cat への参照つきで型安全に insert / select でき、status は pending が既定値になる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();

    await db.insert(notifications).values({
      catId: cat.id,
      kind: "shampoo_elapsed",
      dedupeKey: `${cat.id}:shampoo_elapsed:2026-09-01`,
      title: "シャンプーの時期です",
      body: "前回のシャンプーから2ヶ月が経過しました",
      url: `/cats/${cat.id}/shampoo-records`,
      dueAt: new Date("2026-09-07T00:00:00.000Z"),
    });

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.catId, cat.id));

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
    expect(rows[0].readAt).toBeNull();
    expect(rows[0].snoozedUntil).toBeNull();
  });

  it("同じ dedupe_key を onConflictDoNothing で insert しても二重に作られない", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "みけ", sex: "male" })
      .returning();

    const values = {
      catId: cat.id,
      kind: "weight_measurement" as const,
      dedupeKey: `${cat.id}:weight_measurement:2026-09-01`,
      title: "体重測定のお願い",
      body: "前回の体重測定から14日が経過しました",
      url: `/cats/${cat.id}/weight-records`,
      dueAt: new Date("2026-09-07T00:00:00.000Z"),
    };

    await db.insert(notifications).values(values).onConflictDoNothing({
      target: notifications.dedupeKey,
    });
    await db.insert(notifications).values(values).onConflictDoNothing({
      target: notifications.dedupeKey,
    });

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.catId, cat.id));

    expect(rows).toHaveLength(1);
  });
});
