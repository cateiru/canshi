import type { Metadata } from "next";
import { Breadcrumb, NavCard } from "@/components/ui";
import { HouseholdIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { requireUser } from "@/features/auth/session";
import { createHouseholdAction } from "@/features/households/actions";
import { HouseholdCreateForm } from "@/features/households/HouseholdCreateForm";
import { HOUSEHOLD_ROLE_LABEL } from "@/features/households/labels";
import { listHouseholdSummariesForUser } from "@/features/households/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "家の設定 | CANSHI",
};

export const dynamic = "force-dynamic";

export default async function HouseholdsSettingsPage() {
  const user = await requireUser();
  const householdList = await listHouseholdSummariesForUser(user.id);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "家の設定" },
        ]}
      />

      <header className={styles.header}>
        <RecordPageHeading icon={HouseholdIcon}>家の設定</RecordPageHeading>
        <p className={styles.description}>
          所属している家の名前やメンバー、ごはん商品・プリセットを管理できます。
          新しく家を作成すると、あなたがその家のオーナーになります。
        </p>
      </header>

      {householdList.length === 0 ? (
        <Surface className={styles.emptyState}>
          <HouseholdIcon aria-hidden="true" size={32} />
          <p>所属している家がありません。</p>
          <p>
            猫を登録するには家が必要です。下のフォームから家を作成してください。
          </p>
        </Surface>
      ) : (
        <ul className={styles.list}>
          {householdList.map((household) => (
            <li key={household.id}>
              <NavCard
                href={`/settings/households/${household.id}`}
                icon={HouseholdIcon}
                title={household.name}
                titleAs="h2"
                description={`メンバー${household.memberCount}人・猫${household.catCount}匹（あなたは${HOUSEHOLD_ROLE_LABEL[household.role]}）`}
              />
            </li>
          ))}
        </ul>
      )}

      <Surface title="家を作成する" titleId="household-create-heading" gap="md">
        <HouseholdCreateForm
          action={createHouseholdAction.bind(null, "settings")}
        />
      </Surface>
    </main>
  );
}
