import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { updateWaterRecordAction } from "@/features/water-records/actions";
import { getWaterRecordById } from "@/features/water-records/queries";
import { WaterRecordForm } from "@/features/water-records/WaterRecordForm";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditWaterRecordPageProps = {
  params: Promise<{ catId: string; waterRecordId: string }>;
};

export default async function EditWaterRecordPage({
  params,
}: EditWaterRecordPageProps) {
  const { catId, waterRecordId } = await params;
  const [cat, waterRecord] = await Promise.all([
    getCatById(catId),
    getWaterRecordById(waterRecordId),
  ]);

  if (!cat || !waterRecord || waterRecord.catId !== catId) {
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
          { label: "編集する" },
        ]}
      />

      <h1>{cat.name}の水の記録を編集する</h1>
      <WaterRecordForm
        action={updateWaterRecordAction.bind(null, catId, waterRecord.id)}
        waterRecord={waterRecord}
        submitLabel="更新する"
      />
    </main>
  );
}
