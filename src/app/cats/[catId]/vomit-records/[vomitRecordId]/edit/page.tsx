import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { VomitIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { resolveMediaLimits } from "@/features/media/domain/limits";
import { toMediaAssetView } from "@/features/media/domain/view";
import { listMediaAssetsByRecord } from "@/features/media/infrastructure/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { VOMIT_RECORD_MEDIA_TYPE } from "@/features/vomit-records/domain/media";
import { getVomitRecordById } from "@/features/vomit-records/infrastructure/queries";
import { updateVomitRecordAction } from "@/features/vomit-records/presentation/actions";
import { VomitRecordForm } from "@/features/vomit-records/presentation/VomitRecordForm";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditVomitRecordPageProps = {
  params: Promise<{ catId: string; vomitRecordId: string }>;
};

export default async function EditVomitRecordPage({
  params,
}: EditVomitRecordPageProps) {
  const { catId, vomitRecordId } = await params;
  const [cat, vomitRecord] = await Promise.all([
    getAccessibleCat(catId),
    getVomitRecordById(vomitRecordId),
  ]);

  if (!cat || !vomitRecord || vomitRecord.catId !== catId) {
    notFound();
  }

  const mediaAssets = await listMediaAssetsByRecord(
    VOMIT_RECORD_MEDIA_TYPE,
    vomitRecord.id,
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "嘔吐記録", href: `/cats/${catId}/vomit-records` },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={VomitIcon}>
        {cat.name}の嘔吐記録を編集する
      </RecordPageHeading>
      <VomitRecordForm
        action={updateVomitRecordAction.bind(null, catId, vomitRecord.id)}
        catId={catId}
        vomitRecord={vomitRecord}
        mediaAssets={mediaAssets.map(toMediaAssetView)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="更新する"
      />
    </main>
  );
}
