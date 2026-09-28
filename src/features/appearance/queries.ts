import { cookies } from "next/headers";
import {
  type Appearance,
  CONTRAST_COOKIE_NAME,
  parseContrast,
  parseTheme,
  THEME_COOKIE_NAME,
} from "./preferences";

/** この端末の見た目設定をリクエストの cookie から読み取る */
export async function getAppearance(): Promise<Appearance> {
  const cookieStore = await cookies();

  return {
    theme: parseTheme(cookieStore.get(THEME_COOKIE_NAME)?.value),
    contrast: parseContrast(cookieStore.get(CONTRAST_COOKIE_NAME)?.value),
  };
}
