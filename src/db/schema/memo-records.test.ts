// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { memoRecords } from "./memo-records";

describe("memo_records テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("日付ありのメモと日付なしのメモを insert / select できる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();

    await db.insert(memoRecords).values([
      {
        catId: cat.id,
        recordedAt: new Date("2026-10-31T08:00:00.000Z"),
        content: "爪を切った",
      },
      { catId: cat.id, content: "好きなおもちゃはねずみ" },
    ]);

    const rows = await db.select().from(memoRecords);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.recordedAt)).toEqual([
      new Date("2026-10-31T08:00:00.000Z"),
      null,
    ]);
  });
});
