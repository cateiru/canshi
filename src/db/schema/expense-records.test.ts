// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { expenseRecordCats } from "./expense-record-cats";
import { expenseRecords } from "./expense-records";
import { hospitalVisits } from "./hospital-visits";

describe("expense_records テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("猫に紐付けずに insert / select できる", async () => {
    const [record] = await db
      .insert(expenseRecords)
      .values({
        spentAt: new Date("2026-09-15T00:00:00.000Z"),
        amountYen: 1280,
        category: "food",
        memo: "カリカリ 2kg",
      })
      .returning();

    expect(record.category).toBe("food");
    expect(record.amountYen).toBe(1280);
    expect(record.hospitalVisitId).toBeNull();
  });

  it("複数の猫と多対多で紐付けられる", async () => {
    const [tama] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();
    const [mike] = await db
      .insert(cats)
      .values({ name: "みけ", sex: "male" })
      .returning();
    const [record] = await db
      .insert(expenseRecords)
      .values({
        spentAt: new Date("2026-09-15T00:00:00.000Z"),
        amountYen: 800,
        category: "hygiene",
      })
      .returning();

    await db.insert(expenseRecordCats).values([
      { expenseRecordId: record.id, catId: tama.id },
      { expenseRecordId: record.id, catId: mike.id },
    ]);

    const rows = await db
      .select()
      .from(expenseRecordCats)
      .where(eq(expenseRecordCats.expenseRecordId, record.id));

    expect(rows.map((row) => row.catId).sort()).toEqual(
      [tama.id, mike.id].sort(),
    );
  });

  it("通院記録と紐付けられる", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "しろ", sex: "female" })
      .returning();
    const [visit] = await db
      .insert(hospitalVisits)
      .values({
        catId: cat.id,
        visitedAt: new Date("2026-09-15T10:00:00.000Z"),
        reason: "ワクチン接種",
      })
      .returning();

    const [record] = await db
      .insert(expenseRecords)
      .values({
        spentAt: new Date("2026-09-15T00:00:00.000Z"),
        amountYen: 5500,
        category: "hospital",
        hospitalVisitId: visit.id,
      })
      .returning();

    expect(record.hospitalVisitId).toBe(visit.id);
  });
});
