import { Breadcrumb, ButtonLink } from "@/components/ui";
import { ScaledIcon } from "@/components/ui/ScaledIcon/ScaledIcon";
import { requireUser } from "@/features/auth/presentation/session";
import { createCatAction } from "@/features/cats/presentation/actions";
import { CatForm } from "@/features/cats/presentation/CatForm";
import { CatIcon } from "@/features/cats/presentation/CatIcon";
import { listHouseholdsForUser } from "@/features/households/infrastructure/queries";
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
          { label: "ねこ一覧", href: "/cats" },
          { label: "ねこを登録する" },
        ]}
      />

      <RecordPageHeading icon={CatIcon}>ねこを登録する</RecordPageHeading>
      {households.length === 0 ? (
        <Surface className={styles.emptyState}>
          <ScaledIcon icon={CatIcon} aria-hidden="true" size={32} />
          <p>所属している家がありません。</p>
          <p>ねこを登録するには家が必要です。先に家を作成してください。</p>
          <ButtonLink
            href="/settings/households/new?from=cats"
            variant="primary"
          >
            家を作成する
          </ButtonLink>
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
