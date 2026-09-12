import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { VomitIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById } from "@/features/cats/queries";
import { resolveMediaLimits } from "@/features/media/limits";
import { listMediaAssetsByRecord } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { updateVomitRecordAction } from "@/features/vomit-records/actions";
import { VOMIT_RECORD_MEDIA_TYPE } from "@/features/vomit-records/media";
import { getVomitRecordById } from "@/features/vomit-records/queries";
import { VomitRecordForm } from "@/features/vomit-records/VomitRecordForm";
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
    getCatById(catId),
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
