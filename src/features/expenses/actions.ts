"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  cats,
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
  hospitalVisits,
} from "@/db/schema";
import { requireCatAccess } from "@/features/auth/session";
import {
  type LinkableHospitalVisit,
  listHospitalVisitsOnDate,
} from "@/features/hospital-visits/queries";
import { householdCatIdsQuery } from "@/features/households/queries";
import { syncRecordMediaFromForm } from "@/features/media/attach";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import {
  combineDateTimeUtc,
  splitDateTimeUtc,
} from "@/features/shared/datetime";
import { EXPENSE_MEDIA_TYPE } from "./media";
import {
  type HospitalExpenseCandidate,
  listHospitalExpensesOnDate,
} from "./queries";
import { type ExpenseFormFieldErrors, expenseFormSchema } from "./schema";
import {
  deleteExpenseStatements,
  insertExpenseCats,
  insertExpenseHospitalVisits,
} from "./storage";

/**
 * 保存に成功すると `savedRecordId` を返す。写真はフォームで選んだ時点で下書きとして
 * アップロード済みのため、ここでは送られた asset ID を記録に紐付ける（`syncRecordMediaFromForm`）。
 * 一覧への遷移はクライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type ExpenseFormState = MediaFormState & {
  fieldErrors?: ExpenseFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return expenseFormSchema.safeParse({
    spentDate: formData.get("spentDate"),
    amountYen: formData.get("amountYen"),
    category: formData.get("category"),
    memo: formData.get("memo"),
    catIds: formData.getAll("catIds"),
    hospitalVisitIds: formData.getAll("hospitalVisitIds"),
  });
}

/**
 * 導線になっている猫にログイン中のユーザーがアクセスできることを確認し、その猫の家の ID を返す。
 * 支出は家に属し、記録したページの猫の家の支出として扱うため、家はクライアントから受け取らない
 */
async function requireExpenseHousehold(catId: string): Promise<string> {
  const { cat } = await requireCatAccess(catId);
  // ユーザーがアクセスできる猫は、家に所属している（`getCatForUser` 参照）
  return cat.householdId as string;
}

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

type ExpenseFormData = ReturnType<typeof expenseFormSchema.parse>;

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

/** `catId` は記録したページの猫。支出はその猫の家に属する */
export async function createExpenseAction(
  catId: string,
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const householdId = await requireExpenseHousehold(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const links = await resolveLinks(db, householdId, parsed.data, null);
  if (!links.ok) {
    return { fieldErrors: links.fieldErrors };
  }

  const id = crypto.randomUUID();
  const insertRecord = db
    .insert(expenseRecords)
    .values({ id, householdId, ...buildValues(parsed.data) });

  await db.batch([
    insertRecord,
    ...insertExpenseCats(db, id, links.catIds),
    ...insertExpenseHospitalVisits(db, id, links.hospitalVisitIds),
  ]);

  const mediaError = await syncRecordMediaFromForm(
    EXPENSE_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

/** `catId` は編集しているページの猫。その猫の家の支出記録だけを編集できる */
export async function updateExpenseAction(
  catId: string,
  id: string,
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const householdId = await requireExpenseHousehold(catId);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
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

  const links = await resolveLinks(db, householdId, parsed.data, id);
  if (!links.ok) {
    return { fieldErrors: links.fieldErrors };
  }

  // 紐付く猫・通院記録は差分更新せず、いったん削除してから選択されたものを入れ直す。
  // 紐付けられるのは支出と同じ家の猫・通院記録だけのため、すべてフォームの選択肢に含まれる
  const updateRecord = db
    .update(expenseRecords)
    .set({ ...buildValues(parsed.data), updatedAt: new Date() })
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

  const mediaError = await syncRecordMediaFromForm(
    EXPENSE_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function deleteExpenseAction(
  catId: string,
  id: string,
): Promise<void> {
  const householdId = await requireExpenseHousehold(catId);
  const db = getDb();
  const [existing] = await db
    .select({ id: expenseRecords.id })
    .from(expenseRecords)
    .where(
      and(
        eq(expenseRecords.id, id),
        eq(expenseRecords.householdId, householdId),
      ),
    )
    .limit(1);
  if (!existing) redirect(`/cats/${catId}/expenses`, "replace");
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(EXPENSE_MEDIA_TYPE, id);
  await db.batch(deleteExpenseStatements(db, id));
  redirect(`/cats/${catId}/expenses`, "replace");
}

const dateSchema = z.string().date();

/**
 * 支出記録のフォームで、支出日と同じ日の、ページの猫の家の通院記録（紐付けの候補）を取得する。
 * 編集中の支出記録の ID を渡すと、すでに紐付いている通院記録も含める。
 * 日付を変えるたびにクライアントから呼ぶ読み取り専用の Action
 */
export async function listLinkableHospitalVisitsAction(
  catId: string,
  date: string,
  expenseRecordId?: string,
): Promise<LinkableHospitalVisit[]> {
  const householdId = await requireExpenseHousehold(catId);
  const parsed = dateSchema.safeParse(date);
  if (!parsed.success) {
    return [];
  }
  return listHospitalVisitsOnDate(householdId, parsed.data, expenseRecordId);
}

/**
 * 通院記録のフォームで、受診日と同じ日の、通院する猫の家のカテゴリ「病院」の支出記録
 * （紐付けの候補）を取得する。通院記録の作成時にクライアントから呼ぶ読み取り専用の Action
 */
export async function listSameDayHospitalExpensesAction(
  catId: string,
  date: string,
): Promise<HospitalExpenseCandidate[]> {
  const householdId = await requireExpenseHousehold(catId);
  const parsed = dateSchema.safeParse(date);
  if (!parsed.success) {
    return [];
  }
  return listHospitalExpensesOnDate(householdId, parsed.data);
}
