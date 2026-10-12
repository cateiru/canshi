"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { sanitizeCallbackUrl } from "./callbackUrl";
import { isDevelopmentLoginEnabled } from "./developmentLogin";
import { loginWithEmail } from "./login";
import { requireUser } from "./session";
import {
  deleteSession,
  deleteUserSession,
  deleteUserSessions,
} from "./sessions";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "./sessionToken";

/**
 * 開発環境（`next dev`）だけで使えるログイン。Cloudflare Access を通さず、入力した
 * メールアドレスでログインする（e2e・VRT もこれを使う）。本番ビルドでは
 * `process.env.NODE_ENV` が "production" に置き換わるため、常にエラーになる
 */
export async function developmentLoginAction(
  formData: FormData,
): Promise<void> {
  const { env } = getCloudflareContext();
  if (!isDevelopmentLoginEnabled(env)) {
    throw new Error("開発用のログインは使えません");
  }
  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    throw new Error("メールアドレスを入力してください");
  }

  const { token, expiresAt } = await loginWithEmail(
    email,
    env,
    (await headers()).get("user-agent"),
  );
  (await cookies()).set(
    SESSION_COOKIE_NAME,
    token,
    sessionCookieOptions(expiresAt),
  );
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

/**
 * ログイン中のユーザーのセッションをすべて削除し（この端末以外も含めてログアウトする）、
 * この端末の Cookie も消す。Server Action はどのパスからでも呼べるため、
 * Cookie のセッションが有効なことを `requireUser` で確かめてから削除する
 */
export async function logoutAllDevicesAction(): Promise<void> {
  const user = await requireUser();
  await deleteUserSessions(user.id);
  (await cookies()).delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

/**
 * ログイン中のユーザーのセッションを 1 つ削除する（端末一覧から指定した端末をログアウトする）。
 * 別のユーザーのセッションは削除できない。この端末のセッションを指定したときは、
 * Cookie も消してログインページへ移る
 */
export async function logoutSessionAction(sessionId: string): Promise<void> {
  const user = await requireUser();
  const cookieStore = await cookies();
  const { isCurrent } = await deleteUserSession(
    user.id,
    sessionId,
    cookieStore.get(SESSION_COOKIE_NAME)?.value,
  );
  if (isCurrent) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    redirect("/login");
  }
  revalidatePath("/settings/account");
}
