import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { ExpenseIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat, listCurrentUserCats } from "@/features/auth/session";
import { updateExpenseAction } from "@/features/expenses/actions";
import { ExpenseForm } from "@/features/expenses/ExpenseForm";
import { EXPENSE_MEDIA_TYPE } from "@/features/expenses/media";
import { getExpenseById } from "@/features/expenses/queries";
import { listHospitalVisitsOnDate } from "@/features/hospital-visits/queries";
import { resolveMediaLimits } from "@/features/media/limits";
import { listMediaAssetsByRecord } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
import { splitDateTimeUtc } from "@/features/shared/datetime";
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
  const [cat, allCats] = await Promise.all([
    getAccessibleCat(catId),
    listCurrentUserCats(),
  ]);

  if (!cat) {
    notFound();
  }
  // 支出は家に属するため、表示中の猫の家の支出だけを編集できる
  // （アクセスできる猫は家に所属している。`getCatForUser` 参照）
  const householdId = cat.householdId as string;
  const expense = await getExpenseById(householdId, expenseId);
  if (!expense) {
    notFound();
  }

  const spentDate = splitDateTimeUtc(expense.spentAt).date;
  const [mediaAssets, linkableHospitalVisits] = await Promise.all([
    listMediaAssetsByRecord(EXPENSE_MEDIA_TYPE, expense.id),
    // 「病院」の支出は、紐付けの候補になる同じ日の通院記録を最初から表示する
    expense.category === "hospital"
      ? listHospitalVisitsOnDate(householdId, spentDate, expense.id)
      : undefined,
  ]);

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
        action={updateExpenseAction.bind(null, catId, expense.id)}
        // 関連する猫は支出と同じ家の猫から選ぶ
        cats={allCats.filter((entry) => entry.householdId === householdId)}
        expense={expense}
        initialLinkableHospitalVisits={
          linkableHospitalVisits
            ? { date: spentDate, visits: linkableHospitalVisits }
            : undefined
        }
        mediaAssets={mediaAssets.map(toMediaAssetView)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="更新する"
      />
    </main>
  );
}
