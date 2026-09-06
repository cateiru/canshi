// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";

describe("cats テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("型安全に insert / select できる", async () => {
    await db.insert(cats).values({
      name: "たま",
      sex: "female",
      birthDate: "2020-04-01",
      adoptedAt: "2020-06-01",
    });

    const rows = await db.select().from(cats);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("たま");
    expect(rows[0].sex).toBe("female");
    expect(rows[0].birthDate).toBe("2020-04-01");
    expect(rows[0].id).toEqual(expect.any(String));
  });
});
