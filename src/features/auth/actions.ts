"use server";

import { signIn, signOut } from "@/auth";
import { sanitizeCallbackUrl } from "./callbackUrl";

/** `/login` のログインボタン。認証はまだ行わず、登録済みのユーザーとしてログインする */
export async function loginAction(formData: FormData): Promise<void> {
  await signIn("credentials", {
    redirectTo: sanitizeCallbackUrl(formData.get("callbackUrl")),
  });
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
