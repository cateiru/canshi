"use server";

import { revalidatePath } from "next/cache";
import { requireHouseholdAccess, requireUser } from "@/features/auth/session";
import type { SubmitRedirect } from "@/features/navigation/types";
import {
  acceptHouseholdInvitation,
  createHouseholdInvitation,
  householdInvitationPath,
  revokeHouseholdInvitation,
} from "./invitations";
import {
  createHousehold,
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

export type CreateHouseholdFormState = SubmitRedirect & {
  fieldErrors?: HouseholdNameFormFieldErrors;
};

/**
 * 家を作成したあとの遷移先。家の設定からはメンバーを招待できる家のページへ、
 * 猫一覧からは作成した家が並ぶ猫一覧へ戻す
 */
const CREATE_HOUSEHOLD_REDIRECT = {
  settings: (householdId: string) => `/settings/households/${householdId}`,
  cats: () => "/cats",
} as const;

export type CreateHouseholdDestination = keyof typeof CREATE_HOUSEHOLD_REDIRECT;

/** 家を作成し、作成したユーザーをオーナーにする */
export async function createHouseholdAction(
  destination: CreateHouseholdDestination,
  _prevState: CreateHouseholdFormState,
  formData: FormData,
): Promise<CreateHouseholdFormState> {
  const user = await requireUser();
  const parsed = householdNameFormSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { householdId } = await createHousehold(user.id, parsed.data.name);

  revalidatePath("/settings/households", "layout");
  revalidatePath("/cats");
  // bind した値はクライアントから書き換えられるため、知らない値は家の設定へ戻す
  const redirectTo = Object.hasOwn(CREATE_HOUSEHOLD_REDIRECT, destination)
    ? CREATE_HOUSEHOLD_REDIRECT[destination](householdId)
    : CREATE_HOUSEHOLD_REDIRECT.settings(householdId);
  return { redirectTo };
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

export type CreateHouseholdInvitationActionResult =
  | { ok: true; path: string; expiresAt: Date }
  | { ok: false; error: string };

/**
 * 家への招待 URL を発行する。URL のオリジンは Host ヘッダーに頼らず、呼び出し側（ブラウザ）で
 * `location.origin` を付けるため、ここではパスだけを返す
 */
export async function createHouseholdInvitationAction(
  householdId: string,
): Promise<CreateHouseholdInvitationActionResult> {
  const { user } = await requireHouseholdAccess(householdId);
  const result = await createHouseholdInvitation(householdId, user.id);
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    path: householdInvitationPath(result.token),
    expiresAt: result.expiresAt,
  };
}

export async function revokeHouseholdInvitationAction(
  householdId: string,
  invitationId: string,
): Promise<HouseholdMemberActionResult> {
  const { user } = await requireHouseholdAccess(householdId);
  const result = await revokeHouseholdInvitation(
    householdId,
    user.id,
    invitationId,
  );
  return result.ok ? {} : { error: result.error };
}

/** 招待 URL から家に参加する。参加したら、家の猫が並ぶ猫一覧へ移る */
export async function acceptHouseholdInvitationAction(
  token: string,
): Promise<HouseholdMemberActionResult> {
  const user = await requireUser();
  const result = await acceptHouseholdInvitation(token, user.id);
  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath("/settings/households", "layout");
  revalidatePath("/cats");
  return { redirectTo: "/cats" };
}
