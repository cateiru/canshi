"use server";

import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  cats,
  cleaningRecords,
  cleaningTargets,
  expenseRecordCats,
  expenseRecordHospitalVisits,
  feedingRecords,
  hospitalVisits,
  medicationDoses,
  medications,
  notificationSettings,
  notifications,
  poopRecords,
  shampooRecords,
  symptoms,
  vomitRecords,
  waterRecords,
  weightRecords,
} from "@/db/schema";
import { deleteMediaAssetsByCat } from "@/features/media/storage";
import type { SubmitRedirect } from "@/features/navigation/types";
import { applyProfileImageChange } from "./applyProfileImage";
import type { SubmittedBirthDate } from "./birthDate";
import { parseProfileImageChange } from "./profileImageForm";
import {
  BIRTH_DATE_PRECISIONS,
  type CatFormFieldErrors,
  catFormSchema,
  resolveBirthDate,
} from "./schema";

export type CatFormState = SubmitRedirect & {
  fieldErrors?: CatFormFieldErrors;
  formError?: string;
  // 入力エラーで戻したときに、送信した生年月日の入力欄と値を表示し直すための値
  submittedBirthDate?: SubmittedBirthDate;
};

function readSubmittedBirthDate(formData: FormData): SubmittedBirthDate {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const precision = formData.get("birthDatePrecision");
  return {
    precision: BIRTH_DATE_PRECISIONS.find((value) => value === precision),
    birthDate: text("birthDate"),
    birthYear: text("birthYear"),
    birthMonth: text("birthMonth"),
  };
}

function parseFormData(formData: FormData) {
  const parsed = catFormSchema.safeParse({
    name: formData.get("name"),
    sex: formData.get("sex"),
    birthDatePrecision: formData.get("birthDatePrecision"),
    birthDate: formData.get("birthDate"),
    birthYear: formData.get("birthYear"),
    birthMonth: formData.get("birthMonth"),
    breed: formData.get("breed"),
    adoptedAt: formData.get("adoptedAt"),
  });
  if (!parsed.success) {
    return {
      success: false as const,
      fieldErrors: parsed.error.flatten().fieldErrors,
      submittedBirthDate: readSubmittedBirthDate(formData),
    };
  }

  const birth = resolveBirthDate(parsed.data);
  if (!birth.success) {
    return {
      success: false as const,
      fieldErrors: birth.fieldErrors,
      submittedBirthDate: readSubmittedBirthDate(formData),
    };
  }

  return {
    success: true as const,
    data: {
      name: parsed.data.name,
      sex: parsed.data.sex,
      birthDate: birth.data.birthDate,
      birthDatePrecision: birth.data.birthDatePrecision,
      breed: parsed.data.breed ?? null,
      adoptedAt: parsed.data.adoptedAt ?? null,
    },
  };
}

export async function createCatAction(
  _prevState: CatFormState,
  formData: FormData,
): Promise<CatFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.fieldErrors,
      submittedBirthDate: parsed.submittedBirthDate,
    };
  }

  const db = getDb();
  const [created] = await db
    .insert(cats)
    .values(parsed.data)
    .returning({ id: cats.id });

  return { redirectTo: `/cats/${created.id}` };
}

export async function updateCatAction(
  id: string,
  _prevState: CatFormState,
  formData: FormData,
): Promise<CatFormState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.fieldErrors,
      submittedBirthDate: parsed.submittedBirthDate,
    };
  }

  const db = getDb();
  const result = await db
    .update(cats)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(cats.id, id))
    .returning({ id: cats.id });

  if (result.length === 0) {
    return { formError: "猫が見つかりませんでした" };
  }

  const profileImageError = await applyProfileImageChange(
    id,
    parseProfileImageChange(formData),
  );
  if (profileImageError) {
    return { formError: profileImageError };
  }

  return { redirectTo: `/cats/${id}` };
}

export async function deleteCatAction(id: string): Promise<SubmitRedirect> {
  const db = getDb();
  // media_assets.cat_id が cats.id を参照しているため、猫に紐付くメディア（R2 のオブジェクトと行）を
  // 先に削除する。R2 の削除に失敗した場合はここで例外になり、猫と記録は残る
  await deleteMediaAssetsByCat(id);
  // 各記録テーブルは cats.id への外部キー制約（ON DELETE no action）を持つため、
  // 猫本体より先に紐づく記録を削除しておく。symptoms と hospital_visits は
  // 互いを参照しうるため、削除前にまず双方の紐付け（hospital_visit_id /
  // symptom_id）を解除して循環を断ち切る。medications.symptom_id が
  // symptoms を参照しているため、medications（と、それに依存する
  // medicationDoses）は symptoms より先に削除する。途中で失敗して猫だけ残る
  // /一部の記録だけ消えるような中途半端な状態にならないよう、1つの
  // db.batch でまとめて原子的に実行する
  await db.batch([
    db.delete(feedingRecords).where(eq(feedingRecords.catId, id)),
    db.delete(poopRecords).where(eq(poopRecords.catId, id)),
    db.delete(weightRecords).where(eq(weightRecords.catId, id)),
    db.delete(vomitRecords).where(eq(vomitRecords.catId, id)),
    db.delete(waterRecords).where(eq(waterRecords.catId, id)),
    db.delete(shampooRecords).where(eq(shampooRecords.catId, id)),
    // cleaning_records は cats・cleaning_targets の双方を参照するため、
    // cleaning_targets より先に削除する
    db.delete(cleaningRecords).where(eq(cleaningRecords.catId, id)),
    db.delete(cleaningTargets).where(eq(cleaningTargets.catId, id)),
    // 支出記録そのものはすべての猫で共通のため削除せず、この猫との紐付けだけを外す。
    // 結果として関連する猫が 0 件になった支出は「どの猫にも紐付かない共通の支出」として残る
    db.delete(expenseRecordCats).where(eq(expenseRecordCats.catId, id)),
    db
      .update(symptoms)
      .set({ hospitalVisitId: null })
      .where(eq(symptoms.catId, id)),
    db
      .update(medications)
      .set({ hospitalVisitId: null })
      .where(eq(medications.catId, id)),
    db
      .update(hospitalVisits)
      .set({ symptomId: null })
      .where(eq(hospitalVisits.catId, id)),
    // expense_record_hospital_visits も hospital_visits を参照しているため、
    // 通院記録を削除する前に紐付けを外す。支出記録そのものは家計簿として残す
    db
      .delete(expenseRecordHospitalVisits)
      .where(
        inArray(
          expenseRecordHospitalVisits.hospitalVisitId,
          db
            .select({ id: hospitalVisits.id })
            .from(hospitalVisits)
            .where(eq(hospitalVisits.catId, id)),
        ),
      ),
    db.delete(hospitalVisits).where(eq(hospitalVisits.catId, id)),
    db.delete(medicationDoses).where(eq(medicationDoses.catId, id)),
    db.delete(medications).where(eq(medications.catId, id)),
    db.delete(symptoms).where(eq(symptoms.catId, id)),
    db.delete(notifications).where(eq(notifications.catId, id)),
    db.delete(notificationSettings).where(eq(notificationSettings.catId, id)),
    db.delete(cats).where(eq(cats.id, id)),
  ]);
  return { redirectTo: "/cats" };
}
