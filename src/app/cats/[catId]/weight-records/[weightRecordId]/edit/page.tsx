import { notFound } from "next/navigation";
import { TbWeight } from "react-icons/tb";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { updateWeightRecordAction } from "@/features/weight-records/actions";
import { getWeightRecordById } from "@/features/weight-records/queries";
import { WeightRecordForm } from "@/features/weight-records/WeightRecordForm";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditWeightRecordPageProps = {
  params: Promise<{ catId: string; weightRecordId: string }>;
};

export default async function EditWeightRecordPage({
  params,
}: EditWeightRecordPageProps) {
  const { catId, weightRecordId } = await params;
  const [cat, weightRecord] = await Promise.all([
    getCatById(catId),
    getWeightRecordById(weightRecordId),
  ]);

  if (!cat || !weightRecord || weightRecord.catId !== catId) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "体重記録", href: `/cats/${catId}/weight-records` },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={TbWeight}>
        {cat.name}の体重記録を編集する
      </RecordPageHeading>
      <WeightRecordForm
        action={updateWeightRecordAction.bind(null, catId, weightRecord.id)}
        weightRecord={weightRecord}
        submitLabel="更新する"
      />
    </main>
  );
}
