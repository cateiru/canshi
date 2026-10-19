import { and, eq, inArray } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  cats,
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
  hospitalVisits,
} from "@/db/schema";
import { householdCatIdsQuery } from "@/features/households/queries";
import {
  combineDateTimeUtc,
  splitDateTimeUtc,
} from "@/features/shared/datetime";
import type { ExpenseFormFieldErrors, ExpenseFormInput } from "./schema";
import { insertExpenseCats, insertExpenseHospitalVisits } from "./storage";

/*
 * 支出記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 支出の家を参照できるかは呼び出し側で確かめる。MCP は Durable Object の中で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

export type SaveExpenseResult =
  | { id: string }
  | { fieldErrors: ExpenseFormFieldErrors }
  | { formError: string };

/** 関連する猫がすべて存在し、支出の家の猫であることを確認する */
async function verifyCatsExist(
  db: ReturnType<typeof getDb>,
  householdId: string,
  catIds: string[],
): Promise<boolean> {
  // householdId の分を 1 個予約する
  for (const ids of chunkForBoundParameters(catIds, 1)) {
    const rows = await db
      .select({ id: cats.id })
      .from(cats)
      .where(and(inArray(cats.id, ids), eq(cats.householdId, householdId)));
    if (rows.length !== ids.length) return false;
  }
  return true;
}

type ExpenseFormData = ExpenseFormInput;

type ResolvedLinks =
  | { ok: true; catIds: string[]; hospitalVisitIds: string[] }
  | { ok: false; fieldErrors: ExpenseFormFieldErrors };

/**
 * 紐付ける通院記録と関連する猫を確定する。通院記録を紐付けられるのはカテゴリ「病院」のときだけで、
 * それ以外のカテゴリでは紐付けを外す。通院記録は支出の家の猫の、支出日と同じ日のもので、
 * 他の支出記録に紐付いていないものに限る。通院した猫は関連する猫にも含める
 */
async function resolveLinks(
  db: ReturnType<typeof getDb>,
  householdId: string,
  data: ExpenseFormData,
  expenseId: string | null,
): Promise<ResolvedLinks> {
  const hospitalVisitIds =
    data.category === "hospital" ? data.hospitalVisitIds : [];
  const visitCatIds: string[] = [];
  // householdId の分を 1 個予約する
  for (const ids of chunkForBoundParameters(hospitalVisitIds, 1)) {
    const rows = await db
      .select({
        catId: hospitalVisits.catId,
        visitedAt: hospitalVisits.visitedAt,
        expenseRecordId: expenseRecordHospitalVisits.expenseRecordId,
      })
      .from(hospitalVisits)
      .leftJoin(
        expenseRecordHospitalVisits,
        eq(expenseRecordHospitalVisits.hospitalVisitId, hospitalVisits.id),
      )
      .where(
        and(
          inArray(hospitalVisits.id, ids),
          inArray(hospitalVisits.catId, householdCatIdsQuery(db, householdId)),
        ),
      );
    if (rows.length !== ids.length) {
      return {
        ok: false,
        fieldErrors: {
          hospitalVisitIds: [
            "通院記録が見つかりませんでした。選び直してください",
          ],
        },
      };
    }
    for (const row of rows) {
      // すでにこの支出に紐付いている通院記録は、共有中に受診日が変わって日付がずれていることがあるため
      // そのまま残せるようにする
      const alreadyLinked =
        expenseId != null && row.expenseRecordId === expenseId;
      if (
        !alreadyLinked &&
        splitDateTimeUtc(row.visitedAt).date !== data.spentDate
      ) {
        return {
          ok: false,
          fieldErrors: {
            hospitalVisitIds: [
              "支出日と同じ日の通院記録だけを紐付けられます。選び直してください",
            ],
          },
        };
      }
      if (row.expenseRecordId != null && row.expenseRecordId !== expenseId) {
        return {
          ok: false,
          fieldErrors: {
            hospitalVisitIds: [
              "ほかの支出記録に紐付いている通院記録があります。選び直してください",
            ],
          },
        };
      }
      visitCatIds.push(row.catId);
    }
  }

  const catIds = [...new Set([...data.catIds, ...visitCatIds])];
  if (!(await verifyCatsExist(db, householdId, catIds))) {
    return {
      ok: false,
      fieldErrors: {
        catIds: ["関連する猫が見つかりませんでした。選び直してください"],
      },
    };
  }
  return { ok: true, catIds, hospitalVisitIds };
}

function buildValues(data: ExpenseFormData) {
  return {
    // 支出は日付だけを入力するため、時刻は 00:00（UTC）で固定する
    spentAt: combineDateTimeUtc(data.spentDate, "00:00"),
    amountYen: data.amountYen,
    category: data.category,
    memo: data.memo ?? null,
  };
}

/** 家の支出記録を追加する。関連する猫・通院記録は同じ家のものに限る */
export async function createExpense(
  householdId: string,
  data: ExpenseFormInput,
  d1?: D1Database,
): Promise<SaveExpenseResult> {
  const db = getDb(d1);
  const links = await resolveLinks(db, householdId, data, null);
  if (!links.ok) {
    return { fieldErrors: links.fieldErrors };
  }

  const id = crypto.randomUUID();
  const insertRecord = db
    .insert(expenseRecords)
    .values({ id, householdId, ...buildValues(data) });

  await db.batch([
    insertRecord,
    ...insertExpenseCats(db, id, links.catIds),
    ...insertExpenseHospitalVisits(db, id, links.hospitalVisitIds),
  ]);
  return { id };
}

/** 家の支出記録を更新する。関連する猫・通院記録は入れ直す */
export async function updateExpense(
  householdId: string,
  id: string,
  data: ExpenseFormInput,
  d1?: D1Database,
): Promise<SaveExpenseResult> {
  const db = getDb(d1);
  const inHousehold = and(
    eq(expenseRecords.id, id),
    eq(expenseRecords.householdId, householdId),
  );
  const [existing] = await db
    .select({ id: expenseRecords.id })
    .from(expenseRecords)
    .where(inHousehold)
    .limit(1);

  if (!existing) {
    return { formError: "支出記録が見つかりませんでした" };
  }

  const links = await resolveLinks(db, householdId, data, id);
  if (!links.ok) {
    return { fieldErrors: links.fieldErrors };
  }

  // 紐付く猫・通院記録は差分更新せず、いったん削除してから選択されたものを入れ直す。
  // 紐付けられるのは支出と同じ家の猫・通院記録だけのため、すべてフォームの選択肢に含まれる
  const updateRecord = db
    .update(expenseRecords)
    .set({ ...buildValues(data), updatedAt: new Date() })
    .where(inHousehold);
  const deleteCatLinks = db
    .delete(expenseRecordCats)
    .where(eq(expenseRecordCats.expenseRecordId, id));
  const deleteHospitalVisitLinks = db
    .delete(expenseRecordHospitalVisits)
    .where(eq(expenseRecordHospitalVisits.expenseRecordId, id));

  await db.batch([
    updateRecord,
    deleteCatLinks,
    deleteHospitalVisitLinks,
    ...insertExpenseCats(db, id, links.catIds),
    ...insertExpenseHospitalVisits(db, id, links.hospitalVisitIds),
  ]);
  return { id };
}
