import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { BroomIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { getCleaningRecordById } from "@/features/cleaning/infrastructure/recordQueries";
import { getCleaningTargetById } from "@/features/cleaning/infrastructure/targetQueries";
import { CleaningRecordForm } from "@/features/cleaning/presentation/CleaningRecordForm";
import { updateCleaningRecordAction } from "@/features/cleaning/presentation/recordActions";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
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
    getAccessibleCat(catId),
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
          { label: "トップ", href: "/home" },
          { label: "ねこ一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "掃除記録", href: `/cats/${catId}/cleaning` },
          {
            label: cleaningTarget.name,
            href: `/cats/${catId}/cleaning/targets/${targetId}/records`,
          },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={BroomIcon}>
        {cleaningTarget.name}の記録を編集する
      </RecordPageHeading>
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
