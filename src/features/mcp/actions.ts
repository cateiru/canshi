"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/features/auth/session";
import { revokeUserMcpConnection } from "./connections";

/**
 * ログイン中のユーザーの AI との接続を 1 つ解除する。Server Action はどのパスからでも
 * 呼べるため、Cookie のセッションが有効なことを `requireUser` で確かめ、そのユーザーの
 * 接続だけを解除する。解除した接続は、次のリクエストからアクセストークンが使えなくなる
 */
export async function revokeMcpConnectionAction(
  connectionId: string,
): Promise<void> {
  const user = await requireUser();
  await revokeUserMcpConnection(user.id, connectionId);
  revalidatePath("/settings/ai-connections");
}
