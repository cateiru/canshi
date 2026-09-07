// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { weightRecords } from "./weight-records";

describe("weight_records テーブル", () => {
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

    await db.insert(weightRecords).values({
      catId: cat.id,
      occurredAt: new Date("2026-09-07T08:00:00.000Z"),
      inputMethod: "auto",
      combinedWeightKg: 65.2,
      humanWeightKg: 61,
      catWeightKg: 4.2,
    });

    const rows = await db.select().from(weightRecords);

    expect(rows).toHaveLength(1);
    expect(rows[0].catId).toBe(cat.id);
    expect(rows[0].catWeightKg).toBeCloseTo(4.2);
  });
});
