import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { PoopIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { resolveMediaLimits } from "@/features/media/domain/limits";
import { toMediaAssetView } from "@/features/media/domain/view";
import { listMediaAssetsByRecord } from "@/features/media/infrastructure/queries";
import { POOP_RECORD_MEDIA_TYPE } from "@/features/poop-records/domain/media";
import { getPoopRecordById } from "@/features/poop-records/infrastructure/queries";
import { updatePoopRecordAction } from "@/features/poop-records/presentation/actions";
import { PoopRecordForm } from "@/features/poop-records/presentation/PoopRecordForm";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditPoopRecordPageProps = {
  params: Promise<{ catId: string; poopRecordId: string }>;
};

export default async function EditPoopRecordPage({
  params,
}: EditPoopRecordPageProps) {
  const { catId, poopRecordId } = await params;
  const [cat, poopRecord] = await Promise.all([
    getAccessibleCat(catId),
    getPoopRecordById(poopRecordId),
  ]);

  if (!cat || !poopRecord || poopRecord.catId !== catId) {
    notFound();
  }

  const mediaAssets = await listMediaAssetsByRecord(
    POOP_RECORD_MEDIA_TYPE,
    poopRecord.id,
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ねこ一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "うんち記録", href: `/cats/${catId}/poop-records` },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={PoopIcon}>
        {cat.name}のうんち記録を編集する
      </RecordPageHeading>
      <PoopRecordForm
        action={updatePoopRecordAction.bind(null, catId, poopRecord.id)}
        catId={catId}
        poopRecord={poopRecord}
        mediaAssets={mediaAssets.map(toMediaAssetView)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="更新する"
      />
    </main>
  );
}
