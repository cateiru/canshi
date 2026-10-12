import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui";
import { HouseholdIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import { createHouseholdAction } from "@/features/households/actions";
import { HouseholdCreateForm } from "@/features/households/HouseholdCreateForm";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "家を作成する | CANSHI",
};

export const dynamic = "force-dynamic";

type NewHouseholdPageProps = {
  // 猫一覧（家がないときの案内）から来たときは、作成後に猫一覧へ戻す
  searchParams: Promise<{ from?: string | string[] }>;
};

export default async function NewHouseholdPage({
  searchParams,
}: NewHouseholdPageProps) {
  const { from } = await searchParams;
  await requireUser();
  const destination = from === "cats" ? "cats" : "settings";

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "家の設定", href: "/settings/households" },
          { label: "家を作成する" },
        ]}
      />

      <header className={styles.header}>
        <RecordPageHeading icon={HouseholdIcon}>家を作成する</RecordPageHeading>
        <p className={styles.description}>
          作成すると、あなたがその家のオーナーになります。家族は、家の設定から発行する招待
          URL で家に招待できます。
        </p>
      </header>

      <Surface gap="md">
        <HouseholdCreateForm
          action={createHouseholdAction.bind(null, destination)}
        />
      </Surface>
    </main>
  );
}
