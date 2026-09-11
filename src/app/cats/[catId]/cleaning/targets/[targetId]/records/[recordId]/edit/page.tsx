import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { CleaningRecordForm } from "@/features/cleaning/CleaningRecordForm";
import { updateCleaningRecordAction } from "@/features/cleaning/recordActions";
import { getCleaningRecordById } from "@/features/cleaning/recordQueries";
import { getCleaningTargetById } from "@/features/cleaning/targetQueries";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditCleaningRecordPageProps = {
  params: Promise<{ catId: string; targetId: string; recordId: string }>;
};

export default async function EditCleaningRecordPage({
  params,
}: EditCleaningRecordPageProps) {
  const { catId, targetId, recordId } = await params;
  const [cat, cleaningTarget, cleaningRecord] = await Promise.all([
    getCatById(catId),
    getCleaningTargetById(targetId),
    getCleaningRecordById(recordId),
  ]);

  if (
    !cat ||
    !cleaningTarget ||
    cleaningTarget.catId !== catId ||
    !cleaningRecord ||
    cleaningRecord.catId !== catId ||
    cleaningRecord.cleaningTargetId !== targetId
  ) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "掃除記録", href: `/cats/${catId}/cleaning` },
          {
            label: cleaningTarget.name,
            href: `/cats/${catId}/cleaning/targets/${targetId}/records`,
          },
          { label: "編集する" },
        ]}
      />

      <h1>{cleaningTarget.name}の記録を編集する</h1>
      <CleaningRecordForm
        action={updateCleaningRecordAction.bind(
          null,
          catId,
          targetId,
          cleaningRecord.id,
        )}
        cleaningRecord={cleaningRecord}
        submitLabel="更新する"
      />
    </main>
  );
}
