import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { ExpenseIcon } from "@/components/ui/RecordIcons/RecordIcons";
import {
  getWritableCat,
  listCurrentUserCats,
} from "@/features/auth/presentation/session";
import { isMemorialCat } from "@/features/cats/domain/memorial";
import { EXPENSE_MEDIA_TYPE } from "@/features/expenses/domain/media";
import { getExpenseById } from "@/features/expenses/infrastructure/queries";
import { updateExpenseAction } from "@/features/expenses/presentation/actions";
import { ExpenseForm } from "@/features/expenses/presentation/ExpenseForm";
import { listHospitalVisitsOnDate } from "@/features/hospital-visits/infrastructure/queries";
import { resolveMediaLimits } from "@/features/media/domain/limits";
import { toMediaAssetView } from "@/features/media/domain/view";
import { listMediaAssetsByRecord } from "@/features/media/infrastructure/queries";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "支出記録を編集する",
};

type EditExpensePageProps = {
  params: Promise<{ catId: string; expenseId: string }>;
};

export default async function EditExpensePage({
  params,
}: EditExpensePageProps) {
  const { catId, expenseId } = await params;
  const [cat, allCats] = await Promise.all([
    getWritableCat(catId),
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
          { label: "ねこ一覧", href: "/cats" },
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
        // 関連する猫は支出と同じ家の猫から選ぶ。メモリーへ移した猫は、すでに関連する猫に含まれているときだけ残す
        cats={allCats.filter(
          (entry) =>
            entry.householdId === householdId &&
            (!isMemorialCat(entry) || expense.catIds.includes(entry.id)),
        )}
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
