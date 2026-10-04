"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sanitizeCallbackUrl } from "./callbackUrl";
import { createSession, deleteSession } from "./sessions";
import { SESSION_COOKIE_NAME } from "./sessionToken";
import { getOrCreateLoginUser } from "./users";

/**
 * `/login` のログインボタン。認証はまだ行わず（Issue #160）、登録済みのユーザー
 * （いなければ新しく作った管理者ユーザー）としてログインし、セッションを作る
 */
export async function loginAction(formData: FormData): Promise<void> {
  const user = await getOrCreateLoginUser();
  const { token, expiresAt } = await createSession(user.id);

  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // `next dev` は http で動くため、開発時だけ Secure を外す。本番ビルド（`pnpm cf:preview` を
    // 含む）では常に付ける。cf:preview は http://localhost だが、ブラウザは localhost を
    // 安全な接続として扱うため Secure の Cookie も保存される
    secure: process.env.NODE_ENV !== "development",
    path: "/",
    expires: expiresAt,
  });
  redirect(sanitizeCallbackUrl(formData.get("callbackUrl")));
}

/** セッションを DB から削除し、Cookie も消す。削除後は古い Cookie が残っても使えない */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await deleteSession(token);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
