import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { BrushingIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/session";
import { createBrushingRecordAction } from "@/features/brushing-records/actions";
import { BrushingRecordForm } from "@/features/brushing-records/BrushingRecordForm";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewBrushingRecordPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewBrushingRecordPage({
  params,
}: NewBrushingRecordPageProps) {
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
          {
            label: "ブラッシング記録",
            href: `/cats/${catId}/brushing-records`,
          },
          { label: "記録する" },
        ]}
      />

      <RecordPageHeading icon={BrushingIcon}>
        {cat.name}のブラッシングを記録する
      </RecordPageHeading>
      <BrushingRecordForm
        action={createBrushingRecordAction.bind(null, catId)}
        submitLabel="記録する"
      />
    </main>
  );
}
