// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { shampooRecords } from "./shampoo-records";

describe("shampoo_records テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("cat への参照つきで型安全に insert / select できる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();

    await db.insert(shampooRecords).values({
      catId: cat.id,
      performedAt: new Date("2026-09-07T08:00:00.000Z"),
      memo: "低刺激シャンプーを使用",
    });

    const rows = await db.select().from(shampooRecords);

    expect(rows).toHaveLength(1);
    expect(rows[0].catId).toBe(cat.id);
    expect(rows[0].memo).toBe("低刺激シャンプーを使用");
  });
});
