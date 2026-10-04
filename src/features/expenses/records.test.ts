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
  expenseRecordHospitalVisits,
  expenseRecords,
  hospitalVisits,
  householdMembers,
  households,
  users,
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
// ログイン中のユーザーは常に user-1（household-1 のメンバー）とする。
// 猫単位の認可（requireCatAccess）はこのテストの対象外のため常に許可する
vi.mock("@/features/auth/session", () => ({
  requireUser: async () => ({ id: "user-1" }),
  requireCatAccess: async () => ({}),
}));

const {
  createExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
  listLinkableHospitalVisitsAction,
  listSameDayHospitalExpensesAction,
} = await import("./actions");
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
const { listHospitalVisitsByIds } = await import(
  "@/features/hospital-visits/queries"
);
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
async function addCat(id: string, householdId = "household-1") {
  await db.insert(cats).values({ id, name: id, sex: "unknown", householdId });
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
  await db.insert(users).values([
    { id: "user-1", name: "管理者" },
    { id: "user-2", name: "別の家の人" },
  ]);
  await db.insert(households).values([
    { id: "household-1", name: "わが家" },
    { id: "household-2", name: "別の家" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "household-1", userId: "user-1" },
    { householdId: "household-2", userId: "user-2" },
  ]);
  await addCat("tama");
  await addCat("mike");
});
afterEach(() => sqlite.close());

describe("支出の保存と月別表示", () => {
  it("別の家の猫は関連する猫に選べない", async () => {
    await addCat("kuro", "household-2");

    const result = await createExpenseAction(
      {},
      expenseForm({ catIds: ["tama", "kuro"] }),
    );

    expect(result.fieldErrors?.catIds).toEqual([
      "関連する猫が見つかりませんでした。選び直してください",
    ]);
    expect(await db.select().from(expenseRecords)).toEqual([]);
  });

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
      expenseForm({
        category: "hospital",
        memo: "処方薬",
        catIds: ["mike"],
        hospitalVisitIds: [id as string],
      }),
    );
    await updateHospitalVisitAction(
      "tama",
      id as string,
      {},
      visitForm({ expenseAmountYen: "6200", visitedDate: "2026-09-16" }),
    );
    expect(await getExpenseById(expense?.id as string)).toMatchObject({
      amountYen: 6200,
      category: "hospital",
      memo: "処方薬",
      // 紐付いた通院記録の猫は外せない
      catIds: expect.arrayContaining(["tama", "mike"]),
      hospitalVisitIds: [id],
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
      hospitalVisitIds: [],
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
    const [other] = await db
      .insert(expenseRecords)
      .values({ spentAt: new Date(), amountYen: 100, category: "hospital" })
      .returning();
    await expect(
      db
        .insert(expenseRecordHospitalVisits)
        .values({ expenseRecordId: other.id, hospitalVisitId: id as string }),
    ).rejects.toThrow();
  });
});

async function addVisit(
  catId: string,
  values: Record<string, string> = {},
): Promise<string> {
  const { savedRecordId } = await createHospitalVisitAction(
    catId,
    {},
    visitForm({ expenseAmountYen: "", ...values }),
  );
  return savedRecordId as string;
}

describe("支出記録から通院記録への紐付け", () => {
  it("同じ日の複数の猫の通院記録を 1 件の支出に紐付け、通院した猫も関連付ける", async () => {
    const tamaVisit = await addVisit("tama");
    const mikeVisit = await addVisit("mike");
    const { savedRecordId: id } = await createExpenseAction(
      {},
      expenseForm({
        category: "hospital",
        amountYen: "11000",
        hospitalVisitIds: [tamaVisit, mikeVisit],
      }),
    );
    expect(await getExpenseById(id as string)).toMatchObject({
      catIds: expect.arrayContaining(["tama", "mike"]),
      hospitalVisitIds: expect.arrayContaining([tamaVisit, mikeVisit]),
    });
    expect((await getExpenseByHospitalVisitId(mikeVisit))?.id).toBe(id);
    const linkable = await listLinkableHospitalVisitsAction("2026-09-15");
    expect(linkable).toHaveLength(2);
    expect(linkable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: tamaVisit,
          catName: "tama",
          expenseRecordId: id,
        }),
        expect.objectContaining({
          id: mikeVisit,
          catName: "mike",
          expenseRecordId: id,
        }),
      ]),
    );
    expect(await listLinkableHospitalVisitsAction("2026-09-14")).toEqual([]);
  });

  it("別の家の猫の通院記録は、同じ日でも共有の支出記録を指定しても候補に含めない", async () => {
    await addCat("kuro", "household-2");
    const kuroVisit = await addVisit("kuro");
    const tamaVisit = await addVisit("tama");
    const { savedRecordId: id } = await createExpenseAction(
      {},
      expenseForm({ category: "hospital", hospitalVisitIds: [tamaVisit] }),
    );
    // 支出記録は家を問わず共通のため、別の家の通院記録が同じ支出に紐付いている状態を作る
    await db
      .insert(expenseRecordHospitalVisits)
      .values({ expenseRecordId: id as string, hospitalVisitId: kuroVisit });

    expect(
      (await listLinkableHospitalVisitsAction("2026-09-15")).map(
        (visit) => visit.id,
      ),
    ).toEqual([tamaVisit]);
    expect(
      (await listLinkableHospitalVisitsAction("2026-09-14", id as string)).map(
        (visit) => visit.id,
      ),
    ).toEqual([tamaVisit]);
    // 支出一覧で表示する、支出に紐付いた通院記録も家で絞り込む
    const visitsById = await listHospitalVisitsByIds("user-1", [
      tamaVisit,
      kuroVisit,
    ]);
    expect([...visitsById.keys()]).toEqual([tamaVisit]);
  });

  it("共通の支出を編集しても、フォームに出ない別の家の猫・通院記録との紐付けは残す", async () => {
    await addCat("kuro", "household-2");
    const kuroVisit = await addVisit("kuro");
    const tamaVisit = await addVisit("tama");
    const { savedRecordId } = await createExpenseAction(
      {},
      expenseForm({ category: "hospital", hospitalVisitIds: [tamaVisit] }),
    );
    const id = savedRecordId as string;
    // 別の家のユーザーが、同じ支出に自分の家の猫・通院記録を紐付けた状態を作る
    await db
      .insert(expenseRecordHospitalVisits)
      .values({ expenseRecordId: id, hospitalVisitId: kuroVisit });
    await db
      .insert(expenseRecordCats)
      .values({ expenseRecordId: id, catId: "kuro" });

    async function links() {
      const catIds = (
        await db
          .select({ catId: expenseRecordCats.catId })
          .from(expenseRecordCats)
          .where(eq(expenseRecordCats.expenseRecordId, id))
      ).map((row) => row.catId);
      const visitIds = (
        await db
          .select({ visitId: expenseRecordHospitalVisits.hospitalVisitId })
          .from(expenseRecordHospitalVisits)
          .where(eq(expenseRecordHospitalVisits.expenseRecordId, id))
      ).map((row) => row.visitId);
      return { catIds: catIds.sort(), visitIds: visitIds.sort() };
    }

    // user-1 のフォームには tama の分だけが表示され、そのまま保存し直す
    await updateExpenseAction(
      id,
      {},
      expenseForm({
        category: "hospital",
        memo: "メモだけ変更",
        catIds: ["tama"],
        hospitalVisitIds: [tamaVisit],
      }),
    );
    expect(await links()).toEqual({
      catIds: ["kuro", "tama"],
      visitIds: [kuroVisit, tamaVisit].sort(),
    });

    // 自分の家の紐付けを外しても、別の家の紐付けは残る
    await updateExpenseAction(
      id,
      {},
      expenseForm({ category: "hospital", catIds: [], hospitalVisitIds: [] }),
    );
    expect(await links()).toEqual({ catIds: ["kuro"], visitIds: [kuroVisit] });

    // 「病院」以外にすると、通院記録との紐付けは別の家の分も外す（猫の紐付けは残す）
    await updateExpenseAction(id, {}, expenseForm({ category: "food" }));
    expect(await links()).toEqual({ catIds: ["kuro"], visitIds: [] });
  });

  it("支出日と違う日の通院記録や、ほかの支出に紐付いた通院記録は紐付けない", async () => {
    const otherDayVisit = await addVisit("tama", { visitedDate: "2026-09-14" });
    const linkedVisit = await addVisit("mike", { expenseAmountYen: "3000" });
    expect(
      await createExpenseAction(
        {},
        expenseForm({
          category: "hospital",
          hospitalVisitIds: [otherDayVisit],
        }),
      ),
    ).toHaveProperty("fieldErrors.hospitalVisitIds");
    expect(
      await createExpenseAction(
        {},
        expenseForm({ category: "hospital", hospitalVisitIds: [linkedVisit] }),
      ),
    ).toHaveProperty("fieldErrors.hospitalVisitIds");
    expect(
      await createExpenseAction(
        {},
        expenseForm({ category: "hospital", hospitalVisitIds: ["missing"] }),
      ),
    ).toHaveProperty("fieldErrors.hospitalVisitIds");
    expect(await db.select().from(expenseRecords)).toHaveLength(1);
  });

  it("カテゴリを「病院」以外にすると通院記録との紐付けを外す", async () => {
    const visit = await addVisit("tama", { expenseAmountYen: "5500" });
    const expense = await getExpenseByHospitalVisitId(visit);
    await updateExpenseAction(
      expense?.id as string,
      {},
      expenseForm({
        category: "medicine",
        catIds: ["tama"],
        hospitalVisitIds: [visit],
      }),
    );
    expect(await getExpenseById(expense?.id as string)).toMatchObject({
      category: "medicine",
      hospitalVisitIds: [],
    });
  });

  it("支出記録を削除しても通院記録は残り、紐付けだけ外れる", async () => {
    const visit = await addVisit("tama", { expenseAmountYen: "5500" });
    const expense = await getExpenseByHospitalVisitId(visit);
    await expect(
      deleteExpenseAction("tama", expense?.id as string),
    ).rejects.toThrow("redirect:");
    expect(await db.select().from(hospitalVisits)).toHaveLength(1);
    expect(await db.select().from(expenseRecordHospitalVisits)).toEqual([]);
  });
});

describe("複数の通院記録で共有している病院代", () => {
  async function createSharedExpense() {
    const tamaVisit = await addVisit("tama");
    const mikeVisit = await addVisit("mike");
    const { savedRecordId } = await createExpenseAction(
      {},
      expenseForm({
        category: "hospital",
        amountYen: "11000",
        hospitalVisitIds: [tamaVisit, mikeVisit],
      }),
    );
    return { tamaVisit, mikeVisit, expenseId: savedRecordId as string };
  }

  it("病院代を空にしても支出は削除せず、その通院記録との紐付けだけ外す", async () => {
    const { tamaVisit, mikeVisit, expenseId } = await createSharedExpense();
    await updateHospitalVisitAction(
      "tama",
      tamaVisit,
      {},
      visitForm({ expenseAmountYen: "" }),
    );
    expect(await getExpenseById(expenseId)).toMatchObject({
      amountYen: 11000,
      hospitalVisitIds: [mikeVisit],
    });
    expect(deleteMediaAssetsByRecord).not.toHaveBeenCalled();
    expect(await getExpenseByHospitalVisitId(tamaVisit)).toBeNull();
  });

  it("受診日がずれた通院記録も、支出記録の再保存で紐付けが外れない", async () => {
    const { tamaVisit, mikeVisit, expenseId } = await createSharedExpense();
    await updateHospitalVisitAction(
      "tama",
      tamaVisit,
      {},
      visitForm({ expenseAmountYen: "11000", visitedDate: "2026-09-16" }),
    );
    // 支出フォームは支出日の通院記録に加えて、すでに紐付いている通院記録も候補に出す
    const linkable = await listLinkableHospitalVisitsAction(
      "2026-09-15",
      expenseId,
    );
    expect(linkable.map((visit) => visit.id).sort()).toEqual(
      [tamaVisit, mikeVisit].sort(),
    );
    await updateExpenseAction(
      expenseId,
      {},
      expenseForm({
        category: "hospital",
        amountYen: "11000",
        memo: "メモだけ変更",
        hospitalVisitIds: linkable.map((visit) => visit.id),
      }),
    );
    expect(await getExpenseById(expenseId)).toMatchObject({
      memo: "メモだけ変更",
      hospitalVisitIds: expect.arrayContaining([tamaVisit, mikeVisit]),
    });
    expect((await getExpenseById(expenseId))?.hospitalVisitIds).toHaveLength(2);
  });

  it("金額の変更は反映し、受診日を変えても支出日は変えない", async () => {
    const { tamaVisit, expenseId } = await createSharedExpense();
    await updateHospitalVisitAction(
      "tama",
      tamaVisit,
      {},
      visitForm({ expenseAmountYen: "12000", visitedDate: "2026-09-16" }),
    );
    expect(await getExpenseById(expenseId)).toMatchObject({
      amountYen: 12000,
      spentAt: new Date("2026-09-15T00:00:00Z"),
    });
  });
});

describe("通院記録の作成時に同じ日の支出記録へ紐付ける", () => {
  async function createHospitalExpense(values: Record<string, string> = {}) {
    const { savedRecordId } = await createExpenseAction(
      {},
      expenseForm({
        category: "hospital",
        amountYen: "11000",
        catIds: [],
        ...values,
      }),
    );
    return savedRecordId as string;
  }

  it("同じ日の「病院」の支出記録だけを候補として返す", async () => {
    const hospitalId = await createHospitalExpense({
      catIds: "mike",
      memo: "2匹分",
    });
    await createHospitalExpense({ spentDate: "2026-09-14" });
    await createExpenseAction({}, expenseForm({ category: "food" }));
    expect(await listSameDayHospitalExpensesAction("2026-09-15")).toEqual([
      { id: hospitalId, amountYen: 11000, memo: "2匹分", catNames: ["mike"] },
    ]);
    expect(await listSameDayHospitalExpensesAction("invalid")).toEqual([]);
  });

  it("別の家の猫の名前は候補に含めず「不明な猫」と表示する", async () => {
    await addCat("kuro", "household-2");
    const hospitalId = await createHospitalExpense({ catIds: "tama" });
    // 支出記録は家を問わず共通のため、別の家の猫が同じ支出に関連付いている状態を作る
    await db
      .insert(expenseRecordCats)
      .values({ expenseRecordId: hospitalId, catId: "kuro" });

    const [candidate] = await listSameDayHospitalExpensesAction("2026-09-15");
    expect(candidate.catNames.sort()).toEqual(["tama", "不明な猫"].sort());
  });

  it("選んだ支出記録に紐付け、通院した猫も関連付ける", async () => {
    const expenseId = await createHospitalExpense();
    const tamaVisit = await addVisit("tama", {
      linkExpenseRecordId: expenseId,
    });
    const mikeVisit = await addVisit("mike", {
      linkExpenseRecordId: expenseId,
    });
    expect(await getExpenseById(expenseId)).toMatchObject({
      amountYen: 11000,
      catIds: expect.arrayContaining(["tama", "mike"]),
      hospitalVisitIds: expect.arrayContaining([tamaVisit, mikeVisit]),
    });
    expect(await db.select().from(expenseRecords)).toHaveLength(1);
  });

  it("作成後の再送信（添付の保存の再試行）では、紐付けた支出記録を削除しない", async () => {
    const expenseId = await createHospitalExpense();
    const visit = await addVisit("tama", { linkExpenseRecordId: expenseId });
    // 添付の保存だけ失敗すると、再送信は病院代が空欄のまま更新 Action で行われる
    expect(
      await updateHospitalVisitAction(
        "tama",
        visit,
        {},
        visitForm({ expenseAmountYen: "", linkExpenseRecordId: expenseId }),
      ),
    ).toEqual({ savedRecordId: visit, formError: undefined });
    expect(await getExpenseById(expenseId)).toMatchObject({
      amountYen: 11000,
      hospitalVisitIds: [visit],
    });
    expect(deleteMediaAssetsByRecord).not.toHaveBeenCalled();

    // 紐付けていない支出記録の ID が送られても、空欄なら通常どおり紐付けた支出記録を扱う
    const otherId = await createHospitalExpense();
    await updateHospitalVisitAction(
      "tama",
      visit,
      {},
      visitForm({ expenseAmountYen: "", linkExpenseRecordId: otherId }),
    );
    expect(await getExpenseById(expenseId)).toBeNull();
    expect((await getExpenseById(otherId))?.hospitalVisitIds).toEqual([]);
  });

  it("病院代を入力した場合は既存の支出記録に紐付けず、新しく作る", async () => {
    const expenseId = await createHospitalExpense();
    const visit = await addVisit("tama", {
      expenseAmountYen: "3000",
      linkExpenseRecordId: expenseId,
    });
    expect((await getExpenseByHospitalVisitId(visit))?.amountYen).toBe(3000);
    expect((await getExpenseById(expenseId))?.hospitalVisitIds).toEqual([]);
  });

  it("別の日やカテゴリの支出記録には紐付けない", async () => {
    const otherDayId = await createHospitalExpense({ spentDate: "2026-09-14" });
    const { savedRecordId: foodId } = await createExpenseAction(
      {},
      expenseForm({ category: "food" }),
    );
    for (const linkExpenseRecordId of [
      otherDayId,
      foodId as string,
      "missing",
    ]) {
      expect(
        await createHospitalVisitAction(
          "tama",
          {},
          visitForm({ expenseAmountYen: "", linkExpenseRecordId }),
        ),
      ).toHaveProperty("formError");
    }
    expect(await db.select().from(hospitalVisits)).toEqual([]);
  });
});
