// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { notificationSettings } from "./notification-settings";

describe("notification_settings テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("cat への参照つきで型安全に insert / select でき、is_enabled は true が既定値になる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();

    await db.insert(notificationSettings).values({
      catId: cat.id,
      kind: "shampoo_elapsed",
      params: { months: 3 },
    });

    const rows = await db.select().from(notificationSettings);

    expect(rows).toHaveLength(1);
    expect(rows[0].isEnabled).toBe(true);
    expect(rows[0].params).toEqual({ months: 3 });
  });

  it("同じ cat_id・kind・reference_id の組は重複して insert できない", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "みけ", sex: "male" })
      .returning();

    await db.insert(notificationSettings).values({
      catId: cat.id,
      kind: "cleaning_due",
      referenceId: "target-1",
    });

    await expect(
      db.insert(notificationSettings).values({
        catId: cat.id,
        kind: "cleaning_due",
        referenceId: "target-1",
      }),
    ).rejects.toThrow();
  });

  it("reference_id が異なれば同じ cat_id・kind でも insert できる（掃除対象ごとの設定）", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "しろ", sex: "unknown" })
      .returning();

    await db.insert(notificationSettings).values({
      catId: cat.id,
      kind: "cleaning_due",
      referenceId: "target-a",
    });
    await db.insert(notificationSettings).values({
      catId: cat.id,
      kind: "cleaning_due",
      referenceId: "target-b",
    });

    const rows = await db.select().from(notificationSettings);

    expect(rows.filter((row) => row.catId === cat.id)).toHaveLength(2);
  });
});
