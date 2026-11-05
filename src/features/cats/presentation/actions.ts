"use server";

import {
  requireCatAccess,
  requireUser,
} from "@/features/auth/presentation/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import {
  createCatForUser,
  deleteCatForUser,
  updateCatForUser,
} from "../application/mutations";
import type { SubmittedBirthDate } from "../domain/birthDate";
import { HOUSEHOLD_NOT_ALLOWED_ERROR } from "../domain/cat";
import { parseProfileImageChange } from "../domain/profileImageForm";
import {
  BIRTH_DATE_PRECISIONS,
  type CatFormFieldErrors,
  catFormSchema,
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
    householdId: formData.get("householdId"),
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
      householdId: parsed.data.householdId,
    },
  };
}

export async function createCatAction(
  _prevState: CatFormState,
  formData: FormData,
): Promise<CatFormState> {
  const user = await requireUser();
  const parsed = parseFormData(formData);

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

  const result = await updateCatForUser(id, user.id, parsed.data);
  if (result === "household-not-allowed") {
    return {
      fieldErrors: { householdId: [HOUSEHOLD_NOT_ALLOWED_ERROR] },
      ...readSubmittedValues(formData),
    };
  }
  if (result === "not-found") {
    return { formError: "ねこが見つかりませんでした" };
  }

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

export async function deleteCatAction(id: string): Promise<SubmitRedirect> {
  const { user } = await requireCatAccess(id);
  await deleteCatForUser(user.id, id);
  return { redirectTo: "/cats" };
}
