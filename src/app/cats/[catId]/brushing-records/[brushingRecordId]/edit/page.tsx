import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { BrushingIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/session";
import { updateBrushingRecordAction } from "@/features/brushing-records/actions";
import { BrushingRecordForm } from "@/features/brushing-records/BrushingRecordForm";
import { getBrushingRecordById } from "@/features/brushing-records/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditBrushingRecordPageProps = {
  params: Promise<{ catId: string; brushingRecordId: string }>;
};

export default async function EditBrushingRecordPage({
  params,
}: EditBrushingRecordPageProps) {
  const { catId, brushingRecordId } = await params;
  const [cat, brushingRecord] = await Promise.all([
    getAccessibleCat(catId),
    getBrushingRecordById(brushingRecordId),
  ]);

  if (!cat || !brushingRecord || brushingRecord.catId !== catId) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          {
            label: "ブラッシング記録",
            href: `/cats/${catId}/brushing-records`,
          },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={BrushingIcon}>
        {cat.name}のブラッシング記録を編集する
      </RecordPageHeading>
      <BrushingRecordForm
        action={updateBrushingRecordAction.bind(null, catId, brushingRecord.id)}
        brushingRecord={brushingRecord}
        submitLabel="更新する"
      />
    </main>
  );
}
