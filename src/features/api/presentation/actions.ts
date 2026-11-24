"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/presentation/session";
import { parsePermissionsFromForm } from "@/features/external-access/infrastructure/permissions";
import type { PermissionsFormState } from "@/features/external-access/presentation/PermissionsForm";
import {
  createApiToken,
  deleteApiToken,
  updateApiTokenPermissions,
} from "../application/mutations";
import {
  type ApiTokenFormFieldErrors,
  apiTokenFormSchema,
} from "../domain/schema";
import { API_TOKENS_PATH } from "./paths";

const INVALID_PERMISSIONS_ERROR =
  "許可する範囲を保存できませんでした。ページを読み込み直して、もう一度お試しください。";

export type ApiTokenFormState = {
  fieldErrors?: ApiTokenFormFieldErrors;
  formError?: string;
  /** 発行したトークン。DB にはハッシュしか残らないため、画面に渡せるのはこのときだけ */
  issued?: { token: string; expiresAt: string | null };
};

/** ログイン中のユーザーの API トークンを発行する */
export async function createApiTokenAction(
  _prevState: ApiTokenFormState,
  formData: FormData,
): Promise<ApiTokenFormState> {
  const user = await requireUser();
  const parsed = apiTokenFormSchema.safeParse({
    name: formData.get("name") ?? undefined,
    expiration: formData.get("expiration") ?? undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const permissions = await parsePermissionsFromForm(user.id, formData);
  if (!permissions) {
    return { formError: INVALID_PERMISSIONS_ERROR };
  }
  const { token, expiresAt } = await createApiToken(
    user.id,
    parsed.data,
    permissions,
  );
  return { issued: { token, expiresAt: expiresAt?.toISOString() ?? null } };
}

/**
 * ログイン中のユーザーの API トークンに許可する範囲を変える。次のリクエストから反映される。
 * Server Action の引数はクライアントから任意の値を送れるため、自分のトークンだけを変える
 */
export async function updateApiTokenPermissionsAction(
  tokenId: string,
  _prevState: PermissionsFormState,
  formData: FormData,
): Promise<PermissionsFormState> {
  const user = await requireUser();
  const permissions = await parsePermissionsFromForm(user.id, formData);
  if (!permissions) {
    return { formError: INVALID_PERMISSIONS_ERROR };
  }
  if (
    typeof tokenId !== "string" ||
    !(await updateApiTokenPermissions(user.id, tokenId, permissions))
  ) {
    return {
      formError:
        "トークンが見つかりません。削除された可能性があります。設定の「外部接続」の「APIトークン」から確かめてください。",
    };
  }
  revalidatePath(`${API_TOKENS_PATH}/${tokenId}`);
  return {};
}

/** ログイン中のユーザーの API トークンを、アクセス履歴とあわせて削除する */
export async function deleteApiTokenAction(tokenId: string): Promise<void> {
  const user = await requireUser();
  // Server Action の引数はクライアントから任意の値を送れるため、文字列であることを確かめる
  if (typeof tokenId !== "string") {
    throw new Error("トークンの ID が正しくありません");
  }
  await deleteApiToken(user.id, tokenId);
  revalidatePath(API_TOKENS_PATH);
}
