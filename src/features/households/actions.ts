"use server";

import { revalidatePath } from "next/cache";
import { requireHouseholdAccess } from "@/features/auth/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import {
  leaveHousehold,
  removeHouseholdMember,
  renameHousehold,
} from "./management";
import { transferHouseholdOwnership } from "./ownership";
import {
  type HouseholdNameFormFieldErrors,
  householdNameFormSchema,
} from "./schema";

export type HouseholdNameFormState = {
  fieldErrors?: HouseholdNameFormFieldErrors;
  formError?: string;
  /** 保存に成功したときに、フォームの下に表示するメッセージ */
  message?: string;
};

/** 家の名前を保存する。保存後も同じページにとどまり、見出しなどを新しい名前で表示し直す */
export async function updateHouseholdNameAction(
  householdId: string,
  _prevState: HouseholdNameFormState,
  formData: FormData,
): Promise<HouseholdNameFormState> {
  const { user } = await requireHouseholdAccess(householdId);
  const parsed = householdNameFormSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const result = await renameHousehold(householdId, user.id, parsed.data.name);
  if (!result.ok) {
    return { formError: result.error };
  }

  revalidatePath("/settings/households", "layout");
  revalidatePath("/cats");
  return { message: "家の名前を保存しました" };
}

// メンバーの操作は redirect せず、成功/失敗のどちらも戻り値で表現する。
// 呼び出し側（クライアントコンポーネント）が結果を待ち受けて画面更新を行うため
export type HouseholdMemberActionResult = SubmitRedirect & { error?: string };

export async function removeHouseholdMemberAction(
  householdId: string,
  memberUserId: string,
): Promise<HouseholdMemberActionResult> {
  const { user } = await requireHouseholdAccess(householdId);
  const result = await removeHouseholdMember(
    householdId,
    user.id,
    memberUserId,
  );
  return result.ok ? {} : { error: result.error };
}

export async function transferHouseholdOwnershipAction(
  householdId: string,
  nextOwnerUserId: string,
): Promise<HouseholdMemberActionResult> {
  const { user } = await requireHouseholdAccess(householdId);
  const result = await transferHouseholdOwnership(
    householdId,
    user.id,
    nextOwnerUserId,
  );
  return result.ok ? {} : { error: result.error };
}

/** 家から抜ける。抜けたあとは家のページを開けなくなるため、家の一覧へ戻す */
export async function leaveHouseholdAction(
  householdId: string,
): Promise<HouseholdMemberActionResult> {
  const { user } = await requireHouseholdAccess(householdId);
  const result = await leaveHousehold(householdId, user.id);
  return result.ok
    ? { redirectTo: "/settings/households" }
    : { error: result.error };
}
