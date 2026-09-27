// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { expenseRecordCats } from "./expense-record-cats";
import { expenseRecordHospitalVisits } from "./expense-record-hospital-visits";
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

  it("1 件の支出に複数の通院記録を紐付けられ、1 件の通院記録には 1 件の支出だけ紐付けられる", async () => {
    const [shiro] = await db
      .insert(cats)
      .values({ name: "しろ", sex: "female" })
      .returning();
    const [kuro] = await db
      .insert(cats)
      .values({ name: "くろ", sex: "male" })
      .returning();
    const [shiroVisit, kuroVisit] = await db
      .insert(hospitalVisits)
      .values([
        {
          catId: shiro.id,
          visitedAt: new Date("2026-09-15T10:00:00.000Z"),
          reason: "ワクチン接種",
        },
        {
          catId: kuro.id,
          visitedAt: new Date("2026-09-15T10:00:00.000Z"),
          reason: "ワクチン接種",
        },
      ])
      .returning();
    const [record, other] = await db
      .insert(expenseRecords)
      .values([
        {
          spentAt: new Date("2026-09-15T00:00:00.000Z"),
          amountYen: 11000,
          category: "hospital",
        },
        {
          spentAt: new Date("2026-09-15T00:00:00.000Z"),
          amountYen: 500,
          category: "hospital",
        },
      ])
      .returning();

    await db.insert(expenseRecordHospitalVisits).values([
      { expenseRecordId: record.id, hospitalVisitId: shiroVisit.id },
      { expenseRecordId: record.id, hospitalVisitId: kuroVisit.id },
    ]);
    const rows = await db
      .select()
      .from(expenseRecordHospitalVisits)
      .where(eq(expenseRecordHospitalVisits.expenseRecordId, record.id));
    expect(rows.map((row) => row.hospitalVisitId).sort()).toEqual(
      [shiroVisit.id, kuroVisit.id].sort(),
    );

    await expect(
      db
        .insert(expenseRecordHospitalVisits)
        .values({ expenseRecordId: other.id, hospitalVisitId: shiroVisit.id }),
    ).rejects.toThrow();
  });
});
