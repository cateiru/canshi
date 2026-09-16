import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { ExpenseIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById, listCats } from "@/features/cats/queries";
import {
  createExpenseAction,
  updateExpenseAction,
} from "@/features/expenses/actions";
import { ExpenseForm } from "@/features/expenses/ExpenseForm";
import { resolveMediaLimits } from "@/features/media/limits";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewExpensePageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewExpensePage({ params }: NewExpensePageProps) {
  const { catId } = await params;
  const [cat, allCats] = await Promise.all([getCatById(catId), listCats()]);

  if (!cat) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "支出記録", href: `/cats/${catId}/expenses` },
          { label: "記録する" },
        ]}
      />

      <RecordPageHeading icon={ExpenseIcon}>支出を記録する</RecordPageHeading>
      <ExpenseForm
        catId={catId}
        action={createExpenseAction}
        updateAction={updateExpenseAction}
        cats={allCats}
        mediaLimits={resolveMediaLimits()}
        submitLabel="記録する"
      />
    </main>
  );
}
