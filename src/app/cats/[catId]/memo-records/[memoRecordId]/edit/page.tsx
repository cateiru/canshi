import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { MemoIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { resolveMediaLimits } from "@/features/media/domain/limits";
import { toMediaAssetView } from "@/features/media/domain/view";
import { listMediaAssetsByRecord } from "@/features/media/infrastructure/queries";
import { MEMO_RECORD_MEDIA_TYPE } from "@/features/memo-records/domain/media";
import { getMemoRecordById } from "@/features/memo-records/infrastructure/queries";
import { updateMemoRecordAction } from "@/features/memo-records/presentation/actions";
import { MemoRecordForm } from "@/features/memo-records/presentation/MemoRecordForm";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditMemoRecordPageProps = {
  params: Promise<{ catId: string; memoRecordId: string }>;
};

export default async function EditMemoRecordPage({
  params,
}: EditMemoRecordPageProps) {
  const { catId, memoRecordId } = await params;
  const [cat, memoRecord] = await Promise.all([
    getAccessibleCat(catId),
    getMemoRecordById(memoRecordId),
  ]);

  if (!cat || !memoRecord || memoRecord.catId !== catId) {
    notFound();
  }

  const mediaAssets = await listMediaAssetsByRecord(
    MEMO_RECORD_MEDIA_TYPE,
    memoRecord.id,
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "メモ", href: `/cats/${catId}/memo-records` },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={MemoIcon}>
        {cat.name}のメモを編集する
      </RecordPageHeading>
      <MemoRecordForm
        action={updateMemoRecordAction.bind(null, catId, memoRecord.id)}
        catId={catId}
        memoRecord={memoRecord}
        mediaAssets={mediaAssets.map(toMediaAssetView)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="更新する"
      />
    </main>
  );
}
