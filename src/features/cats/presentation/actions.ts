"use server";

import { revalidatePath } from "next/cache";
import {
  requireCatAccess,
  requireUser,
} from "@/features/auth/presentation/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import {
  createCatForUser,
  deleteCatForUser,
  markCatNeuteredForUser,
  updateCatForUser,
} from "../application/mutations";
import type { SubmittedBirthDate } from "../domain/birthDate";
import { HOUSEHOLD_NOT_ALLOWED_ERROR } from "../domain/cat";
import { parseProfileImageChange } from "../domain/profileImageForm";
import {
  BIRTH_DATE_PRECISIONS,
  type CatFormFieldErrors,
  catFormSchema,
  newCatFormSchema,
  resolveBirthDate,
} from "../domain/schema";
import {
  readSubmittedCatChoices,
  type SubmittedCatChoices,
} from "../domain/submittedChoices";
import { applyProfileImageChange } from "../infrastructure/applyProfileImage";

export type CatFormState = SubmitRedirect & {
  fieldErrors?: CatFormFieldErrors;
  formError?: string;
  // 入力エラーで戻したときに、送信した生年月日の入力欄と値を表示し直すための値
  submittedBirthDate?: SubmittedBirthDate;
  // 入力エラーで戻したときに、性別・避妊・去勢・毛色・柄の選択を保持するための値
  submittedChoices?: SubmittedCatChoices;
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

function readSubmittedValues(formData: FormData) {
  return {
    submittedBirthDate: readSubmittedBirthDate(formData),
    submittedChoices: readSubmittedCatChoices(formData),
  };
}

/** 猫のプロフィールの項目を読む。猫を飼う家は登録後は変えられないため、ここでは読まない */
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
    neuterStatus: formData.get("neuterStatus"),
    coatColor: formData.get("coatColor"),
    coatPattern: formData.get("coatPattern"),
    coatWhite: formData.get("coatWhite"),
  });
  if (!parsed.success) {
    return {
      success: false as const,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const birth = resolveBirthDate(parsed.data);
  if (!birth.success) {
    return {
      success: false as const,
      fieldErrors: birth.fieldErrors,
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
      neuterStatus: parsed.data.neuterStatus ?? null,
      coatColor: parsed.data.coatColor ?? null,
      coatPattern: parsed.data.coatPattern ?? null,
      coatWhite: parsed.data.coatWhite ?? null,
    },
  };
}

/** 登録するときの項目を読む。プロフィールの項目に加えて、猫を飼う家を読む */
function parseNewCatFormData(formData: FormData) {
  const household = newCatFormSchema
    .pick({ householdId: true })
    .safeParse({ householdId: formData.get("householdId") });
  const profile = parseFormData(formData);
  if (!household.success || !profile.success) {
    return {
      success: false as const,
      fieldErrors: {
        ...(profile.success ? {} : profile.fieldErrors),
        ...(household.success ? {} : household.error.flatten().fieldErrors),
      },
    };
  }
  return {
    success: true as const,
    data: { ...profile.data, householdId: household.data.householdId },
  };
}

export async function createCatAction(
  _prevState: CatFormState,
  formData: FormData,
): Promise<CatFormState> {
  const user = await requireUser();
  const parsed = parseNewCatFormData(formData);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.fieldErrors,
      ...readSubmittedValues(formData),
    };
  }

  const createdId = await createCatForUser(user.id, parsed.data);
  if (!createdId) {
    return {
      fieldErrors: { householdId: [HOUSEHOLD_NOT_ALLOWED_ERROR] },
      ...readSubmittedValues(formData),
    };
  }

  return { redirectTo: `/cats/${createdId}` };
}

export async function updateCatAction(
  id: string,
  _prevState: CatFormState,
  formData: FormData,
): Promise<CatFormState> {
  const { user } = await requireCatAccess(id);
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return {
      fieldErrors: parsed.fieldErrors,
      ...readSubmittedValues(formData),
    };
  }

  const updated = await updateCatForUser(id, user.id, parsed.data);
  if (!updated) {
    return { formError: "ねこが見つかりませんでした" };
  }
  // 猫のページのレイアウトは、アイコンの猫を毛色で塗る。保存後に遷移しても
  // 共有のレイアウトは描き直されないため、ここで描き直させる
  revalidatePath(`/cats/${id}`, "layout");

  const profileImageError = await applyProfileImageChange(
    id,
    parseProfileImageChange(formData),
    user.id,
  );
  if (profileImageError) {
    // ねこの情報はすでに保存済み。作り直した入力欄が古い値に戻らないよう、送信した値を返す
    return { formError: profileImageError, ...readSubmittedValues(formData) };
  }

  return { redirectTo: `/cats/${id}` };
}

/**
 * 猫の避妊・去勢手術の状況を「済」にする。避妊・去勢の通院記録を追加したあとの確認で「はい」を選んだときに使う。
 * 失敗したときは、確認のダイアログに表示するエラーの文言を返す
 */
export async function markCatNeuteredAction(
  id: string,
): Promise<{ error?: string }> {
  const { user } = await requireCatAccess(id);
  const updated = await markCatNeuteredForUser(id, user.id);
  return updated ? {} : { error: "ねこが見つかりませんでした" };
}

export async function deleteCatAction(id: string): Promise<SubmitRedirect> {
  const { user } = await requireCatAccess(id);
  await deleteCatForUser(user.id, id);
  return { redirectTo: "/cats" };
}
