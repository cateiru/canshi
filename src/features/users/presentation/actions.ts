"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/presentation/session";
import { parseProfileImageChange } from "@/features/cats/domain/profileImageForm";
import type { SubmitRedirect } from "@/features/navigation/types";
import { renameUser } from "../application/profile";
import {
  type UserProfileFormFieldErrors,
  userProfileFormSchema,
} from "../domain/schema";
import { applyUserIconChange } from "../infrastructure/applyUserIcon";

export type UserProfileFormState = SubmitRedirect & {
  fieldErrors?: UserProfileFormFieldErrors;
  formError?: string;
  /** 入力エラーで戻したときに、入力欄へ戻す送信した名前 */
  submittedName?: string;
};

/**
 * ログイン中のユーザーの名前とアイコン画像を保存する。保存したらアカウント設定へ戻り、
 * 家のメンバー一覧などを新しい名前・アイコンで表示し直す
 */
export async function updateUserProfileAction(
  _prevState: UserProfileFormState,
  formData: FormData,
): Promise<UserProfileFormState> {
  const user = await requireUser();
  const name = formData.get("name");
  const parsed = userProfileFormSchema.safeParse({ name });
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      submittedName: typeof name === "string" ? name : undefined,
    };
  }

  await renameUser(user.id, parsed.data.name);
  const iconError = await applyUserIconChange(
    user.id,
    parseProfileImageChange(formData),
  );

  revalidatePath("/settings", "layout");
  if (iconError) {
    return { formError: iconError };
  }
  return { redirectTo: "/settings/account" };
}
