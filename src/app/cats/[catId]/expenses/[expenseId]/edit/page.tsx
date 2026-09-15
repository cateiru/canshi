import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { ExpenseIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById, listCats } from "@/features/cats/queries";
import { updateExpenseAction } from "@/features/expenses/actions";
import { ExpenseForm } from "@/features/expenses/ExpenseForm";
import { EXPENSE_MEDIA_TYPE } from "@/features/expenses/media";
import { getExpenseById } from "@/features/expenses/queries";
import { resolveMediaLimits } from "@/features/media/limits";
import { listMediaAssetsByRecord } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditExpensePageProps = {
  params: Promise<{ catId: string; expenseId: string }>;
};

export default async function EditExpensePage({
  params,
}: EditExpensePageProps) {
  const { catId, expenseId } = await params;
  const [cat, expense, allCats] = await Promise.all([
    getCatById(catId),
    getExpenseById(expenseId),
    listCats(),
  ]);

  if (!cat || !expense) {
    notFound();
  }

  const mediaAssets = await listMediaAssetsByRecord(
    EXPENSE_MEDIA_TYPE,
    expense.id,
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "支出記録", href: `/cats/${catId}/expenses` },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={ExpenseIcon}>
        支出記録を編集する
      </RecordPageHeading>
      <ExpenseForm
        catId={catId}
        action={updateExpenseAction.bind(null, expense.id)}
        cats={allCats}
        expense={expense}
        mediaAssets={mediaAssets.map(toMediaAssetView)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="更新する"
      />
    </main>
  );
}
