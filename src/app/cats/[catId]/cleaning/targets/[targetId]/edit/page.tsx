import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { BroomIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById } from "@/features/cats/queries";
import { CleaningTargetForm } from "@/features/cleaning/CleaningTargetForm";
import {
  deleteCleaningTargetAction,
  updateCleaningTargetAction,
} from "@/features/cleaning/targetActions";
import { getCleaningTargetById } from "@/features/cleaning/targetQueries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type EditCleaningTargetPageProps = {
  params: Promise<{ catId: string; targetId: string }>;
};

export default async function EditCleaningTargetPage({
  params,
}: EditCleaningTargetPageProps) {
  const { catId, targetId } = await params;
  const [cat, cleaningTarget] = await Promise.all([
    getCatById(catId),
    getCleaningTargetById(targetId),
  ]);

  if (!cat || !cleaningTarget || cleaningTarget.catId !== catId) {
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
          { label: "対象を編集する" },
        ]}
      />

      <RecordPageHeading icon={BroomIcon}>
        {cleaningTarget.name}を編集する
      </RecordPageHeading>
      <CleaningTargetForm
        action={updateCleaningTargetAction.bind(null, catId, cleaningTarget.id)}
        cleaningTarget={cleaningTarget}
        submitLabel="更新する"
      />

      <div className={styles.dangerZone}>
        <DeleteRecordButton
          action={deleteCleaningTargetAction.bind(
            null,
            catId,
            cleaningTarget.id,
          )}
          title="掃除対象の削除"
          description="この掃除対象を削除しますか？紐づく実施記録もすべて削除されます。この操作は取り消せません。"
        />
      </div>
    </main>
  );
}
