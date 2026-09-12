import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { WaterIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById } from "@/features/cats/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { createWaterRecordAction } from "@/features/water-records/actions";
import { WaterRecordForm } from "@/features/water-records/WaterRecordForm";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewWaterRecordPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewWaterRecordPage({
  params,
}: NewWaterRecordPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

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
          { label: "水の記録", href: `/cats/${catId}/water-records` },
          { label: "記録する" },
        ]}
      />

      <RecordPageHeading icon={WaterIcon}>
        {cat.name}の水を記録する
      </RecordPageHeading>
      <WaterRecordForm
        action={createWaterRecordAction.bind(null, catId)}
        submitLabel="記録する"
      />
    </main>
  );
}
