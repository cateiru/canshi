"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/session";
import { getUserMcpConnection, revokeUserMcpConnection } from "./connections";
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
 * ログイン中のユーザーの接続の 1 つについて、AI から読み取れる範囲と許可する操作を保存する。
 * 接続済みのアプリには、次のツールの呼び出しから反映される。
 * 接続は grant の ID で指定し、範囲を見分けるクライアントの ID はサーバーで求める
 */
export async function updateMcpPermissionsAction(
  connectionId: string,
  _prevState: McpPermissionsFormState,
  formData: FormData,
): Promise<McpPermissionsFormState> {
  const user = await requireUser();
  // Server Action の引数はクライアントから任意の値を送れるため、自分の接続であることを確かめる
  const connection =
    typeof connectionId === "string"
      ? await getUserMcpConnection(user.id, connectionId)
      : null;
  if (!connection) {
    return {
      formError:
        "接続が見つかりません。解除された可能性があります。設定の「AIとの接続」から確かめてください。",
    };
  }
  if (
    !(await saveMcpPermissionsFromForm(user.id, connection.clientId, formData))
  ) {
    return {
      formError:
        "許可する範囲を保存できませんでした。ページを読み込み直して、もう一度お試しください。",
    };
  }
  revalidatePath(`/settings/ai-connections/${connection.id}`);
  return {};
}
