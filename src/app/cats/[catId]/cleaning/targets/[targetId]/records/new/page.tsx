import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { CleaningRecordForm } from "@/features/cleaning/CleaningRecordForm";
import { createCleaningRecordAction } from "@/features/cleaning/recordActions";
import { getCleaningTargetById } from "@/features/cleaning/targetQueries";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewCleaningRecordPageProps = {
  params: Promise<{ catId: string; targetId: string }>;
};

export default async function NewCleaningRecordPage({
  params,
}: NewCleaningRecordPageProps) {
  const { catId, targetId } = await params;
  const [cat, cleaningTarget] = await Promise.all([
    getCatById(catId),
    getCleaningTargetById(targetId),
  ]);

  if (
    !cat ||
    !cleaningTarget ||
    cleaningTarget.catId !== catId ||
    !cleaningTarget.isActive
  ) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "掃除記録", href: `/cats/${catId}/cleaning` },
          {
            label: cleaningTarget.name,
            href: `/cats/${catId}/cleaning/targets/${targetId}/records`,
          },
          { label: "記録する" },
        ]}
      />

      <h1>{cleaningTarget.name}を記録する</h1>
      <CleaningRecordForm
        action={createCleaningRecordAction.bind(null, catId, targetId)}
        submitLabel="記録する"
      />
    </main>
  );
}
