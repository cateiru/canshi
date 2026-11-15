import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { ExpenseIcon } from "@/components/ui/RecordIcons/RecordIcons";
import {
  getWritableCat,
  listCurrentUserCats,
} from "@/features/auth/presentation/session";
import { isMemorialCat } from "@/features/cats/domain/memorial";
import {
  createExpenseAction,
  updateExpenseAction,
} from "@/features/expenses/presentation/actions";
import { ExpenseForm } from "@/features/expenses/presentation/ExpenseForm";
import { resolveMediaLimits } from "@/features/media/domain/limits";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "支出を記録する",
};

type NewExpensePageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewExpensePage({ params }: NewExpensePageProps) {
  const { catId } = await params;
  const [cat, allCats] = await Promise.all([
    getWritableCat(catId),
    listCurrentUserCats(),
  ]);

  if (!cat) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ねこ一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "支出記録", href: `/cats/${catId}/expenses` },
          { label: "記録する" },
        ]}
      />

      <RecordPageHeading icon={ExpenseIcon}>支出を記録する</RecordPageHeading>
      <ExpenseForm
        catId={catId}
        action={createExpenseAction.bind(null, catId)}
        updateAction={updateExpenseAction.bind(null, catId)}
        // 支出は表示中の猫の家に属するため、関連する猫も同じ家の猫から選ぶ
        // メモリーへ移した猫は、関連する猫に新しく加えられない
        cats={allCats.filter(
          (entry) =>
            entry.householdId === cat.householdId && !isMemorialCat(entry),
        )}
        mediaLimits={resolveMediaLimits()}
        submitLabel="記録する"
      />
    </main>
  );
}
