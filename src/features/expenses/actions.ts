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
import { requireCatAccess, requireUser } from "@/features/auth/session";
import {
  type LinkableHospitalVisit,
  listHospitalVisitsOnDate,
} from "@/features/hospital-visits/queries";
import { accessibleCatIdsQuery } from "@/features/households/queries";
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

/** 関連する猫がすべて存在し、ログイン中のユーザーの家の猫であることを確認する */
async function verifyCatsExist(
  db: ReturnType<typeof getDb>,
  userId: string,
  catIds: string[],
): Promise<boolean> {
  for (const ids of chunkForBoundParameters(catIds)) {
    const rows = await db
      .select({ id: cats.id })
      .from(cats)
      .where(
        and(
          inArray(cats.id, ids),
          inArray(cats.id, accessibleCatIdsQuery(db, userId)),
        ),
      );
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
 * それ以外のカテゴリでは紐付けを外す。通院記録は支出日と同じ日のもので、他の支出記録に
 * 紐付いていないものに限る。通院した猫は関連する猫にも含める
 */
async function resolveLinks(
  db: ReturnType<typeof getDb>,
  userId: string,
  data: ExpenseFormData,
  expenseId: string | null,
): Promise<ResolvedLinks> {
  const hospitalVisitIds =
    data.category === "hospital" ? data.hospitalVisitIds : [];
  const visitCatIds: string[] = [];
  for (const ids of chunkForBoundParameters(hospitalVisitIds)) {
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
          inArray(hospitalVisits.catId, accessibleCatIdsQuery(db, userId)),
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
  if (!(await verifyCatsExist(db, userId, catIds))) {
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

export async function createExpenseAction(
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const user = await requireUser();
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const links = await resolveLinks(db, user.id, parsed.data, null);
  if (!links.ok) {
    return { fieldErrors: links.fieldErrors };
  }

  const id = crypto.randomUUID();
  const insertRecord = db
    .insert(expenseRecords)
    .values({ id, ...buildValues(parsed.data) });

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

export async function updateExpenseAction(
  id: string,
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const user = await requireUser();
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: expenseRecords.id })
    .from(expenseRecords)
    .where(eq(expenseRecords.id, id))
    .limit(1);

  if (!existing) {
    return { formError: "支出記録が見つかりませんでした" };
  }

  const links = await resolveLinks(db, user.id, parsed.data, id);
  if (!links.ok) {
    return { fieldErrors: links.fieldErrors };
  }

  // 紐付く猫・通院記録は差分更新せず、いったん全削除してから選択されたものを入れ直す
  const updateRecord = db
    .update(expenseRecords)
    .set({ ...buildValues(parsed.data), updatedAt: new Date() })
    .where(eq(expenseRecords.id, id));
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
  await requireCatAccess(catId);
  const db = getDb();
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(EXPENSE_MEDIA_TYPE, id);
  await db.batch(deleteExpenseStatements(db, id));
  redirect(`/cats/${catId}/expenses`, "replace");
}

const dateSchema = z.string().date();

/**
 * 支出記録のフォームで、支出日と同じ日の通院記録（紐付けの候補）を取得する。
 * 編集中の支出記録の ID を渡すと、すでに紐付いている通院記録も含める。
 * 日付を変えるたびにクライアントから呼ぶ読み取り専用の Action
 */
export async function listLinkableHospitalVisitsAction(
  date: string,
  expenseRecordId?: string,
): Promise<LinkableHospitalVisit[]> {
  await requireUser();
  const parsed = dateSchema.safeParse(date);
  if (!parsed.success) {
    return [];
  }
  return listHospitalVisitsOnDate(parsed.data, expenseRecordId);
}

/**
 * 通院記録のフォームで、受診日と同じ日のカテゴリ「病院」の支出記録（紐付けの候補）を取得する。
 * 通院記録の作成時にクライアントから呼ぶ読み取り専用の Action
 */
export async function listSameDayHospitalExpensesAction(
  date: string,
): Promise<HospitalExpenseCandidate[]> {
  await requireUser();
  const parsed = dateSchema.safeParse(date);
  if (!parsed.success) {
    return [];
  }
  return listHospitalExpensesOnDate(parsed.data);
}
