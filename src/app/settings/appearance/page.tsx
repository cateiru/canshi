import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui";
import { AppearanceSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAppearance } from "@/features/appearance/infrastructure/queries";
import { AppearanceSettings } from "@/features/appearance/presentation/AppearanceSettings";
import {
  sanitizeCallbackUrl,
  withCallbackUrl,
} from "@/features/auth/domain/callbackUrl";
import { getCurrentUser } from "@/features/auth/presentation/session";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "見た目設定",
};

type AppearanceSettingsPageProps = {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
};

/**
 * 見た目設定。端末ごとの cookie に保存するだけなので、ログインしていなくても開ける
 * （`src/features/auth/domain/publicPaths.ts`）
 */
export default async function AppearanceSettingsPage({
  searchParams,
}: AppearanceSettingsPageProps) {
  const [appearance, user, { callbackUrl }] = await Promise.all([
    getAppearance(),
    getCurrentUser(),
    searchParams,
  ]);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={
          user
            ? [
                { label: "トップ", href: "/home" },
                { label: "設定", href: "/settings" },
                { label: "見た目設定" },
              ]
            : // 未ログインではトップ・設定を開けないため、ログイン画面へ戻れるようにする。
              // ログイン画面から引き継いだログイン後の遷移先も戻す
              [
                {
                  label: "ログイン",
                  href: withCallbackUrl(
                    "/login",
                    sanitizeCallbackUrl(callbackUrl),
                  ),
                },
                { label: "見た目設定" },
              ]
        }
      />

      <header className={styles.header}>
        <RecordPageHeading icon={AppearanceSettingsIcon}>
          見た目設定
        </RecordPageHeading>
        <p className={styles.description}>
          この端末での画面の明るさやアクセントカラー、枠線・文字の見やすさ、文字の大きさを設定できます。
        </p>
      </header>

      <AppearanceSettings initialAppearance={appearance} />
    </main>
  );
}
