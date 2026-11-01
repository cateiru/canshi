import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { MemoIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/session";
import { resolveMediaLimits } from "@/features/media/limits";
import {
  createMemoRecordAction,
  updateMemoRecordAction,
} from "@/features/memo-records/actions";
import { MemoRecordForm } from "@/features/memo-records/MemoRecordForm";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewMemoRecordPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewMemoRecordPage({
  params,
}: NewMemoRecordPageProps) {
  const { catId } = await params;
  const cat = await getAccessibleCat(catId);

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
        mediaLimits={resolveMediaLimits()}
        submitLabel="記録する"
      />
    </main>
  );
}
