"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/session";
import { revokeUserMcpConnection } from "./connections";
import { saveMcpPermissionsFromForm } from "./permissions";

/**
 * ログイン中のユーザーの AI との接続を 1 つ解除する。Server Action はどのパスからでも
 * 呼べるため、Cookie のセッションが有効なことを `requireUser` で確かめ、そのユーザーの
 * 接続だけを解除する。解除した接続は、次のリクエストからアクセストークンが使えなくなる
 */
export async function revokeMcpConnectionAction(
  connectionId: string,
): Promise<void> {
  const user = await requireUser();
  // Server Action の引数はクライアントから任意の値を送れるため、文字列であることを確かめる
  if (typeof connectionId !== "string") {
    throw new Error("接続の ID が正しくありません");
  }
  await revokeUserMcpConnection(user.id, connectionId);
  revalidatePath("/settings/ai-connections");
}

export type McpPermissionsFormState = {
  formError?: string;
};

/**
 * ログイン中のユーザーの、AI との接続から読み取れる範囲を保存する。範囲はユーザーごとに
 * 1 つで、接続済みのすべてのアプリに、次のツールの呼び出しから反映される
 */
export async function updateMcpPermissionsAction(
  _prevState: McpPermissionsFormState,
  formData: FormData,
): Promise<McpPermissionsFormState> {
  const user = await requireUser();
  if (!(await saveMcpPermissionsFromForm(user.id, formData))) {
    return {
      formError:
        "読み取りを許可する範囲を保存できませんでした。ページを読み込み直して、もう一度お試しください。",
    };
  }
  revalidatePath("/settings/ai-connections");
  return {};
}
