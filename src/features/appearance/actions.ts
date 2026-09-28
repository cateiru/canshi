"use server";

import { cookies } from "next/headers";
import {
  APPEARANCE_COOKIE_MAX_AGE_SECONDS,
  CONTRAST_COOKIE_NAME,
  CONTRASTS,
  isOneOf,
  THEME_COOKIE_NAME,
  THEMES,
} from "./preferences";

async function saveAppearanceCookie(name: string, value: string) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    path: "/",
    maxAge: APPEARANCE_COOKIE_MAX_AGE_SECONDS,
    sameSite: "lax",
    httpOnly: true,
  });
}

/** この端末のテーマを保存する。不正な値は保存しない */
export async function saveThemeAction(value: unknown): Promise<void> {
  if (typeof value === "string" && isOneOf(THEMES, value)) {
    await saveAppearanceCookie(THEME_COOKIE_NAME, value);
  }
}

/** この端末のコントラストを保存する。不正な値は保存しない */
export async function saveContrastAction(value: unknown): Promise<void> {
  if (typeof value === "string" && isOneOf(CONTRASTS, value)) {
    await saveAppearanceCookie(CONTRAST_COOKIE_NAME, value);
  }
}
