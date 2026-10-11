"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sanitizeCallbackUrl } from "./callbackUrl";
import { isDevelopmentLoginEnabled } from "./developmentLogin";
import { loginWithEmail } from "./login";
import { deleteSession } from "./sessions";
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

  const { token, expiresAt } = await loginWithEmail(email, env);
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
