import { MemoIcon } from "@canshi/shared/ui/RecordIcons";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getWritableCat } from "@/features/auth/presentation/session";
import { catPageMetadata } from "@/features/cats/presentation/catPageMetadata";
import { resolveMediaLimits } from "@/features/media/domain/limits";
import { listMemoLabels } from "@/features/memo-records/infrastructure/labelQueries";
import {
  createMemoRecordAction,
  updateMemoRecordAction,
} from "@/features/memo-records/presentation/actions";
import { MemoRecordForm } from "@/features/memo-records/presentation/MemoRecordForm";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

export const generateMetadata = catPageMetadata(
  (catName) => `${catName}のメモを記録する`,
);

type NewMemoRecordPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewMemoRecordPage({
  params,
}: NewMemoRecordPageProps) {
  const { catId } = await params;
  const cat = await getWritableCat(catId);

  if (!cat) {
    notFound();
  }
  // アクセスできる猫は家に所属している（`getCatForUser` 参照）
  const labels = await listMemoLabels(cat.householdId as string);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ねこ一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "メモ", href: `/cats/${catId}/memo-records` },
          { label: "記録する" },
        ]}
      />

      <RecordPageHeading icon={MemoIcon}>
        {cat.name}のメモを記録する
      </RecordPageHeading>
      <MemoRecordForm
        catId={catId}
        action={createMemoRecordAction.bind(null, catId)}
        updateAction={updateMemoRecordAction.bind(null, catId)}
        labelSuggestions={labels.map((label) => label.name)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="記録する"
      />
    </main>
  );
}
