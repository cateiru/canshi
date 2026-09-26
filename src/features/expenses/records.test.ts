// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs, { type Database } from "sql.js";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { D1_MAX_BOUND_PARAMETERS } from "@/db/batch";
import type { getDb } from "@/db/client";
import {
  cats,
  expenseRecordCats,
  expenseRecords,
  hospitalVisits,
} from "@/db/schema";

let db: ReturnType<typeof getDb>;
let sqlite: Database;
let SQL: Awaited<ReturnType<typeof initSqlJs>>;
vi.mock("@/db/client", () => ({ getDb: () => db }));
vi.mock("@/features/media/storage", () => ({
  deleteMediaAssetsByRecord: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

const { createExpenseAction, updateExpenseAction, deleteExpenseAction } =
  await import("./actions");
const {
  getExpenseById,
  listExpensesForMonth,
  listExpenseAmountsForMonthRange,
  getExpenseByHospitalVisitId,
} = await import("./queries");
const {
  createHospitalVisitAction,
  updateHospitalVisitAction,
  deleteHospitalVisitAction,
} = await import("@/features/hospital-visits/actions");
const { deleteMediaAssetsByRecord } = await import("@/features/media/storage");

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const entry of Array.isArray(value) ? value : [value])
      data.append(key, entry);
  }
  return data;
}
function expenseForm(values: Record<string, string | string[]> = {}) {
  return form({
    spentDate: "2026-09-15",
    amountYen: "1280",
    category: "food",
    ...values,
  });
}
function visitForm(values: Record<string, string> = {}) {
  return form({
    visitedDate: "2026-09-15",
    visitedTime: "10:00",
    reason: "健診",
    expenseAmountYen: "5500",
    ...values,
  });
}
async function addCat(id: string) {
  await db.insert(cats).values({ id, name: id, sex: "unknown" });
}

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  vi.clearAllMocks();
  sqlite = new SQL.Database();
  const raw = drizzle(sqlite);
  await migrate(raw, { migrationsFolder: "./drizzle" });
  sqlite.run("PRAGMA foreign_keys = ON");
  // 実際の SQLite トランザクションで、D1 の batch とパラメーター上限を再現する。
  const batch = async (
    statements: (PromiseLike<unknown> & { toSQL(): { params: unknown[] } })[],
  ) => {
    sqlite.run("BEGIN");
    try {
      const results: unknown[] = [];
      for (const statement of statements) {
        expect(statement.toSQL().params.length).toBeLessThanOrEqual(
          D1_MAX_BOUND_PARAMETERS,
        );
        results.push(await statement);
      }
      sqlite.run("COMMIT");
      return results;
    } catch (error) {
      sqlite.run("ROLLBACK");
      throw error;
    }
  };
  db = Object.assign(raw, { batch }) as unknown as ReturnType<typeof getDb>;
  await addCat("tama");
  await addCat("mike");
});
afterEach(() => sqlite.close());

describe("支出の保存と月別表示", () => {
  it("複数の猫に関連付けても全体の支出は重複しない", async () => {
    const { savedRecordId: id } = await createExpenseAction(
      {},
      expenseForm({ catIds: ["tama", "mike", "tama"] }),
    );
    expect(await getExpenseById(id as string)).toMatchObject({
      amountYen: 1280,
      catIds: expect.arrayContaining(["tama", "mike"]),
    });
    expect(await listExpensesForMonth(2026, 9)).toHaveLength(1);
    expect(await listExpensesForMonth(2026, 9, { catId: "mike" })).toHaveLength(
      1,
    );
  });

  it("編集で猫を外すと、共通の支出として残る", async () => {
    const { savedRecordId: id } = await createExpenseAction(
      {},
      expenseForm({ catIds: ["tama"] }),
    );
    await updateExpenseAction(
      id as string,
      {},
      expenseForm({ amountYen: "0" }),
    );
    expect(await getExpenseById(id as string)).toMatchObject({
      amountYen: 0,
      catIds: [],
    });
    expect(await listExpensesForMonth(2026, 9, { catId: "tama" })).toEqual([]);
    expect(await listExpensesForMonth(2026, 9)).toHaveLength(1);
  });

  it("未入力の金額や存在しない猫では保存しない", async () => {
    expect(
      await createExpenseAction({}, expenseForm({ amountYen: "" })),
    ).toHaveProperty("fieldErrors.amountYen");
    expect(
      await createExpenseAction({}, expenseForm({ catIds: ["missing"] })),
    ).toHaveProperty("fieldErrors.catIds");
    expect(await listExpensesForMonth(2026, 9)).toEqual([]);
  });

  it("猫の関連付けをD1の上限内に分割して保存・更新できる", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `cat-${i}`);
    for (const id of ids) await addCat(id);
    const { savedRecordId: id } = await createExpenseAction(
      {},
      expenseForm({ catIds: ids }),
    );
    expect((await getExpenseById(id as string))?.catIds).toHaveLength(101);
    await updateExpenseAction(
      id as string,
      {},
      expenseForm({ catIds: ids.slice(0, 51) }),
    );
    expect((await getExpenseById(id as string))?.catIds).toHaveLength(51);
  });

  it("月初を含み、翌月の支出を含めない", async () => {
    for (const spentDate of [
      "2026-08-31",
      "2026-09-01",
      "2026-09-30",
      "2026-10-01",
    ]) {
      await createExpenseAction({}, expenseForm({ spentDate }));
    }
    const records = await listExpensesForMonth(2026, 9);
    expect(
      records.map((record) => record.spentAt.toISOString().slice(0, 10)),
    ).toEqual(["2026-09-30", "2026-09-01"]);
  });

  it("グラフ用に範囲の最初の月初から最後の月末までの支出を返す", async () => {
    for (const spentDate of [
      "2026-06-30",
      "2026-07-01",
      "2026-09-30",
      "2026-10-01",
    ]) {
      await createExpenseAction({}, expenseForm({ spentDate }));
    }
    const records = await listExpenseAmountsForMonthRange(
      { year: 2026, month: 7 },
      { year: 2026, month: 9 },
    );
    expect(
      records.map((record) => record.spentAt.toISOString().slice(0, 10)).sort(),
    ).toEqual(["2026-07-01", "2026-09-30"]);
  });

  it("グラフ用の支出も猫で絞り込める", async () => {
    await createExpenseAction(
      {},
      expenseForm({ catIds: ["tama"], amountYen: "100" }),
    );
    await createExpenseAction(
      {},
      expenseForm({ catIds: ["mike"], amountYen: "200" }),
    );
    await createExpenseAction({}, expenseForm({ amountYen: "300" }));
    const range = [
      { year: 2026, month: 9 },
      { year: 2026, month: 9 },
    ] as const;

    const all = await listExpenseAmountsForMonthRange(...range);
    const forTama = await listExpenseAmountsForMonthRange(...range, {
      catId: "tama",
    });
    expect(all.map((record) => record.amountYen).sort()).toEqual([
      100, 200, 300,
    ]);
    expect(forTama).toEqual([
      expect.objectContaining({ category: "food", amountYen: 100 }),
    ]);
  });

  it("削除すると添付メディアと猫への関連付けも削除する", async () => {
    const { savedRecordId: id } = await createExpenseAction(
      {},
      expenseForm({ catIds: ["tama"] }),
    );
    await expect(deleteExpenseAction("tama", id as string)).rejects.toThrow(
      "redirect:/cats/tama/expenses",
    );
    expect(deleteMediaAssetsByRecord).toHaveBeenCalledWith("expense", id);
    expect(await getExpenseById(id as string)).toBeNull();
    expect(await db.select().from(expenseRecordCats)).toEqual([]);
  });
});

describe("通院記録と病院代の連携", () => {
  it("通院記録と支出を作成し、再編集でも支出を増やさない", async () => {
    const { savedRecordId: id } = await createHospitalVisitAction(
      "tama",
      {},
      visitForm(),
    );
    const expense = await getExpenseByHospitalVisitId(id as string);
    expect(expense).toMatchObject({
      amountYen: 5500,
      category: "hospital",
      spentAt: new Date("2026-09-15T00:00:00Z"),
    });
    await updateExpenseAction(
      expense?.id as string,
      {},
      expenseForm({ category: "medicine", memo: "処方薬", catIds: ["mike"] }),
    );
    await updateHospitalVisitAction(
      "tama",
      id as string,
      {},
      visitForm({ expenseAmountYen: "6200", visitedDate: "2026-09-16" }),
    );
    expect(await getExpenseById(expense?.id as string)).toMatchObject({
      amountYen: 6200,
      category: "medicine",
      memo: "処方薬",
      catIds: ["mike"],
      spentAt: new Date("2026-09-16T00:00:00Z"),
    });
    expect(await db.select().from(expenseRecords)).toHaveLength(1);
  });

  it("0円の病院代は保存し、空欄にした場合は支出だけ削除する", async () => {
    const { savedRecordId: id } = await createHospitalVisitAction(
      "tama",
      {},
      visitForm({ expenseAmountYen: "0" }),
    );
    const expense = await getExpenseByHospitalVisitId(id as string);
    expect(expense?.amountYen).toBe(0);
    await updateHospitalVisitAction(
      "tama",
      id as string,
      {},
      visitForm({ expenseAmountYen: "" }),
    );
    expect(await getExpenseByHospitalVisitId(id as string)).toBeNull();
    expect(deleteMediaAssetsByRecord).toHaveBeenCalledWith(
      "expense",
      expense?.id,
    );
    expect(await db.select().from(hospitalVisits)).toHaveLength(1);
  });

  it("通院記録を削除しても支出と関連する猫は残る", async () => {
    const { savedRecordId: id } = await createHospitalVisitAction(
      "tama",
      {},
      visitForm(),
    );
    const expense = await getExpenseByHospitalVisitId(id as string);
    await expect(
      deleteHospitalVisitAction("tama", id as string),
    ).rejects.toThrow("redirect:");
    expect(await getExpenseById(expense?.id as string)).toMatchObject({
      hospitalVisitId: null,
      catIds: ["tama"],
    });
  });

  it("別の猫の通院記録に対して連携支出を変更しない", async () => {
    const { savedRecordId: id } = await createHospitalVisitAction(
      "tama",
      {},
      visitForm(),
    );
    expect(
      await updateHospitalVisitAction("mike", id as string, {}, visitForm()),
    ).toHaveProperty("formError");
    await expect(
      deleteHospitalVisitAction("mike", id as string),
    ).rejects.toThrow("redirect:");
    expect((await getExpenseByHospitalVisitId(id as string))?.amountYen).toBe(
      5500,
    );
    expect(deleteMediaAssetsByRecord).not.toHaveBeenCalled();
  });

  it("支出の作成に失敗した場合、通院記録も保存しない", async () => {
    sqlite.run(
      "CREATE TRIGGER reject_expense BEFORE INSERT ON expense_records BEGIN SELECT RAISE(ABORT, 'expense failure'); END",
    );
    await expect(
      createHospitalVisitAction("tama", {}, visitForm()),
    ).rejects.toThrow();
    expect(await db.select().from(hospitalVisits)).toEqual([]);
    expect(await db.select().from(expenseRecords)).toEqual([]);
  });

  it("病院代の更新に失敗した場合、通院記録の変更も戻す", async () => {
    const { savedRecordId: id } = await createHospitalVisitAction(
      "tama",
      {},
      visitForm(),
    );
    sqlite.run(
      "CREATE TRIGGER reject_expense_update BEFORE UPDATE ON expense_records BEGIN SELECT RAISE(ABORT, 'expense failure'); END",
    );
    await expect(
      updateHospitalVisitAction(
        "tama",
        id as string,
        {},
        visitForm({ reason: "再診", expenseAmountYen: "6000" }),
      ),
    ).rejects.toThrow();
    const [visit] = await db
      .select()
      .from(hospitalVisits)
      .where(eq(hospitalVisits.id, id as string));
    expect(visit.reason).toBe("健診");
    expect((await getExpenseByHospitalVisitId(id as string))?.amountYen).toBe(
      5500,
    );
  });

  it("同じ通院記録への支出の重複をDBでも拒否する", async () => {
    const { savedRecordId: id } = await createHospitalVisitAction(
      "tama",
      {},
      visitForm(),
    );
    await expect(
      db.insert(expenseRecords).values({
        spentAt: new Date(),
        amountYen: 100,
        category: "hospital",
        hospitalVisitId: id,
      }),
    ).rejects.toThrow();
  });
});
