// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { cleaningRecords } from "./cleaning-records";
import { cleaningTargets } from "./cleaning-targets";

describe("cleaning_records テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("cat・cleaning_target への参照つきで型安全に insert / select できる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();
    const [target] = await db
      .insert(cleaningTargets)
      .values({ catId: cat.id, name: "猫砂", frequencyValue: 7 })
      .returning();

    await db.insert(cleaningRecords).values({
      catId: cat.id,
      cleaningTargetId: target.id,
      performedAt: new Date("2026-09-07T08:00:00.000Z"),
    });

    const rows = await db.select().from(cleaningRecords);

    expect(rows).toHaveLength(1);
    expect(rows[0].catId).toBe(cat.id);
    expect(rows[0].cleaningTargetId).toBe(target.id);
  });
});
