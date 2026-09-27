"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  expenseRecordHospitalVisits,
  expenseRecords,
  hospitalVisits,
  medications,
  symptoms,
} from "@/db/schema";
import { saveHospitalVisitWithExpense } from "@/features/expenses/hospitalVisitExpense";
import { syncRecordMediaFromForm } from "@/features/media/attach";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import type { MediaFormState } from "@/features/media/useMediaFormAction";
import {
  combineDateTimeUtc,
  splitDateTimeUtc,
} from "@/features/shared/datetime";
import { HOSPITAL_VISIT_MEDIA_TYPE } from "./media";
import {
  type HospitalVisitFormFieldErrors,
  hospitalVisitFormSchema,
} from "./schema";

/**
 * 保存に成功すると `savedRecordId` を返す。写真はフォームで選んだ時点で下書きとして
 * アップロード済みのため、ここでは送られた asset ID を記録に紐付ける（`syncRecordMediaFromForm`）。
 * 一覧への遷移はクライアント側（useMediaFormAction）が行うため、ここではリダイレクトしない
 */
export type HospitalVisitFormState = MediaFormState & {
  fieldErrors?: HospitalVisitFormFieldErrors;
};

function parseFormData(formData: FormData) {
  return hospitalVisitFormSchema.safeParse({
    symptomId: formData.get("symptomId"),
    visitedDate: formData.get("visitedDate"),
    visitedTime: formData.get("visitedTime"),
    reason: formData.get("reason"),
    expenseAmountYen: formData.get("expenseAmountYen"),
    linkExpenseRecordId: formData.get("linkExpenseRecordId"),
    diagnosis: formData.get("diagnosis"),
    examinationResults: formData.get("examinationResults"),
    treatment: formData.get("treatment"),
    nextVisitDate: formData.get("nextVisitDate"),
    nextVisitTime: formData.get("nextVisitTime"),
    memo: formData.get("memo"),
  });
}

async function verifySymptomBelongsToCat(
  db: ReturnType<typeof getDb>,
  symptomId: string | undefined,
  catId: string,
): Promise<boolean> {
  if (symptomId == null) {
    return true;
  }
  const [row] = await db
    .select({ id: symptoms.id })
    .from(symptoms)
    .where(and(eq(symptoms.id, symptomId), eq(symptoms.catId, catId)))
    .limit(1);
  return row != null;
}

/**
 * 通院記録の作成時に紐付ける既存の支出記録が、受診日と同じ日のカテゴリ「病院」の
 * 支出記録であることを確かめる
 */
async function verifyLinkableExpense(
  db: ReturnType<typeof getDb>,
  expenseRecordId: string | undefined,
  visitedDate: string,
): Promise<boolean> {
  if (expenseRecordId == null) {
    return true;
  }
  const [row] = await db
    .select({
      category: expenseRecords.category,
      spentAt: expenseRecords.spentAt,
    })
    .from(expenseRecords)
    .where(eq(expenseRecords.id, expenseRecordId))
    .limit(1);
  return (
    row != null &&
    row.category === "hospital" &&
    splitDateTimeUtc(row.spentAt).date === visitedDate
  );
}

function buildValues(data: ReturnType<typeof hospitalVisitFormSchema.parse>) {
  return {
    symptomId: data.symptomId ?? null,
    visitedAt: combineDateTimeUtc(data.visitedDate, data.visitedTime),
    reason: data.reason,
    diagnosis: data.diagnosis ?? null,
    examinationResults: data.examinationResults ?? null,
    treatment: data.treatment ?? null,
    nextVisitAt:
      data.nextVisitDate != null && data.nextVisitTime != null
        ? combineDateTimeUtc(data.nextVisitDate, data.nextVisitTime)
        : null,
    memo: data.memo ?? null,
  };
}

export async function createHospitalVisitAction(
  catId: string,
  _prevState: HospitalVisitFormState,
  formData: FormData,
): Promise<HospitalVisitFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  if (!(await verifySymptomBelongsToCat(db, parsed.data.symptomId, catId))) {
    return { formError: "関連する症状が見つかりませんでした" };
  }
  // 病院代を入力した場合は新しい支出記録を作るため、既存の支出記録には紐付けない
  const linkExpenseRecordId =
    parsed.data.expenseAmountYen == null
      ? parsed.data.linkExpenseRecordId
      : undefined;
  if (
    !(await verifyLinkableExpense(
      db,
      linkExpenseRecordId,
      parsed.data.visitedDate,
    ))
  ) {
    return {
      formError:
        "紐付ける支出記録が見つかりませんでした。もう一度保存してください",
    };
  }

  const values = buildValues(parsed.data);
  const id = crypto.randomUUID();
  await saveHospitalVisitWithExpense(
    db,
    db.insert(hospitalVisits).values({ id, catId, ...values }),
    {
      hospitalVisitId: id,
      catId,
      visitedAt: values.visitedAt,
      amountYen: parsed.data.expenseAmountYen ?? null,
      linkExpenseRecordId,
    },
  );

  const mediaError = await syncRecordMediaFromForm(
    HOSPITAL_VISIT_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function updateHospitalVisitAction(
  catId: string,
  id: string,
  _prevState: HospitalVisitFormState,
  formData: FormData,
): Promise<HospitalVisitFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const db = getDb();
  if (!(await verifySymptomBelongsToCat(db, parsed.data.symptomId, catId))) {
    return { formError: "関連する症状が見つかりませんでした" };
  }

  const [existing] = await db
    .select({ id: hospitalVisits.id })
    .from(hospitalVisits)
    .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId)))
    .limit(1);

  if (!existing) {
    return { formError: "通院記録が見つかりませんでした" };
  }

  const values = buildValues(parsed.data);
  await saveHospitalVisitWithExpense(
    db,
    db
      .update(hospitalVisits)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId))),
    {
      hospitalVisitId: id,
      catId,
      visitedAt: values.visitedAt,
      amountYen: parsed.data.expenseAmountYen ?? null,
      // 既存の支出記録へ紐付けて作成した後の再送信では、紐付けた支出記録を削除せずに残す
      keepLinkedExpenseRecordId: parsed.data.linkExpenseRecordId,
    },
  );

  const mediaError = await syncRecordMediaFromForm(
    HOSPITAL_VISIT_MEDIA_TYPE,
    id,
    formData,
  );
  return { savedRecordId: id, formError: mediaError };
}

export async function deleteHospitalVisitAction(
  catId: string,
  id: string,
): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select({ id: hospitalVisits.id })
    .from(hospitalVisits)
    .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId)))
    .limit(1);
  if (!existing) redirect(`/cats/${catId}/hospital-visits`);
  // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(HOSPITAL_VISIT_MEDIA_TYPE, id);
  // symptoms.hospital_visit_id / medications.hospital_visit_id /
  // expense_record_hospital_visits からの外部キー参照があるため、通院記録を
  // 削除する前に紐付けを解除しておく。支出記録は家計簿として残す必要があるため、
  // 紐付けだけ外して記録自体は削除しない。一連の操作は db.batch でまとめて
  // 原子的に実行する
  await db.batch([
    db
      .update(symptoms)
      .set({ hospitalVisitId: null })
      .where(and(eq(symptoms.hospitalVisitId, id), eq(symptoms.catId, catId))),
    db
      .update(medications)
      .set({ hospitalVisitId: null })
      .where(
        and(eq(medications.hospitalVisitId, id), eq(medications.catId, catId)),
      ),
    db
      .delete(expenseRecordHospitalVisits)
      .where(eq(expenseRecordHospitalVisits.hospitalVisitId, id)),
    db
      .delete(hospitalVisits)
      .where(and(eq(hospitalVisits.id, id), eq(hospitalVisits.catId, catId))),
  ]);
  redirect(`/cats/${catId}/hospital-visits`);
}
