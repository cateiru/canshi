import { Breadcrumb } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { createCatAction } from "@/features/cats/actions";
import { CatForm } from "@/features/cats/CatForm";
import { CatIcon } from "@/features/cats/CatIcon";
import { listHouseholdsForUser } from "@/features/households/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewCatPageProps = {
  // 猫一覧の家のまとまりから来たときに、その家を最初から選んでおく
  searchParams: Promise<{ householdId?: string | string[] }>;
};

export default async function NewCatPage({ searchParams }: NewCatPageProps) {
  const { householdId } = await searchParams;
  const user = await requireUser();
  const households = await listHouseholdsForUser(user.id);
  // 所属していない家の ID が指定された場合は、先頭の家を選んでおく
  const defaultHouseholdId = households.find(
    (household) => household.id === householdId,
  )?.id;

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: "猫を登録する" },
        ]}
      />

      <RecordPageHeading icon={CatIcon}>猫を登録する</RecordPageHeading>
      {households.length === 0 ? (
        <Surface className={styles.emptyState}>
          <CatIcon aria-hidden="true" size={32} />
          <p>所属している家がありません。</p>
          <p>
            猫を登録するには家が必要です。管理者に家の作成を依頼してください。
          </p>
        </Surface>
      ) : (
        <>
          <p>名前や誕生日を登録して、毎日の記録をはじめましょう。</p>
          <CatForm
            action={createCatAction}
            households={households}
            defaultHouseholdId={defaultHouseholdId}
            submitLabel="登録する"
          />
        </>
      )}
    </main>
  );
}
