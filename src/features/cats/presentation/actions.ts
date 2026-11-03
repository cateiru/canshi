"use server";

import {
  requireCatAccess,
  requireUser,
} from "@/features/auth/presentation/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import {
  createCatForUser,
  deleteCatForUser,
  HOUSEHOLD_NOT_ALLOWED_ERROR,
  updateCatForUser,
} from "../application/mutations";
import type { SubmittedBirthDate } from "../domain/birthDate";
import {
  BIRTH_DATE_PRECISIONS,
  type CatFormFieldErrors,
  catFormSchema,
  resolveBirthDate,
} from "../domain/schema";
import { applyProfileImageChange } from "../infrastructure/applyProfileImage";
import { parseProfileImageChange } from "./profileImageForm";

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
    householdId: formData.get("householdId"),
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
      submittedBirthDate: parsed.submittedBirthDate,
    };
  }

  const createdId = await createCatForUser(user.id, parsed.data);
  if (!createdId) {
    return {
      fieldErrors: { householdId: [HOUSEHOLD_NOT_ALLOWED_ERROR] },
      submittedBirthDate: readSubmittedBirthDate(formData),
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
      submittedBirthDate: parsed.submittedBirthDate,
    };
  }

  const result = await updateCatForUser(id, user.id, parsed.data);
  if (result === "household-not-allowed") {
    return {
      fieldErrors: { householdId: [HOUSEHOLD_NOT_ALLOWED_ERROR] },
      submittedBirthDate: readSubmittedBirthDate(formData),
    };
  }
  if (result === "not-found") {
    return { formError: "猫が見つかりませんでした" };
  }

  const profileImageError = await applyProfileImageChange(
    id,
    parseProfileImageChange(formData),
    user.id,
  );
  if (profileImageError) {
    return { formError: profileImageError };
  }

  return { redirectTo: `/cats/${id}` };
}

export async function deleteCatAction(id: string): Promise<SubmitRedirect> {
  const { user } = await requireCatAccess(id);
  await deleteCatForUser(user.id, id);
  return { redirectTo: "/cats" };
}
