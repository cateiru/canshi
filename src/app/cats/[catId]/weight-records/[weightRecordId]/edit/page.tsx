import { notFound } from "next/navigation";
import { getCatById } from "@/features/cats/queries";
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
      <h1>{cat.name}の体重記録を編集する</h1>
      <WeightRecordForm
        action={updateWeightRecordAction.bind(null, catId, weightRecord.id)}
        weightRecord={weightRecord}
        submitLabel="更新する"
      />
    </main>
  );
}
