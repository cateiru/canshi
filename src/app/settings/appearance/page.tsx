import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui";
import { AppearanceSettingsIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { AppearanceSettings } from "@/features/appearance/AppearanceSettings";
import { getAppearance } from "@/features/appearance/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "見た目設定 | CANSHI",
};

export default async function AppearanceSettingsPage() {
  const appearance = await getAppearance();

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "見た目設定" },
        ]}
      />

      <header className={styles.header}>
        <RecordPageHeading icon={AppearanceSettingsIcon}>
          見た目設定
        </RecordPageHeading>
        <p className={styles.description}>
          この端末での画面の明るさや、枠線・文字の見やすさ、文字の大きさを設定できます。
        </p>
      </header>

      <AppearanceSettings initialAppearance={appearance} />
    </main>
  );
}
