import { notFound } from "next/navigation";
import { getCatById } from "@/features/cats/queries";
import { createWeightRecordAction } from "@/features/weight-records/actions";
import { WeightRecordForm } from "@/features/weight-records/WeightRecordForm";
import styles from "../page.module.css";

type NewWeightRecordPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewWeightRecordPage({
  params,
}: NewWeightRecordPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <h1>{cat.name}の体重を記録する</h1>
      <WeightRecordForm
        action={createWeightRecordAction.bind(null, catId)}
        submitLabel="記録する"
      />
    </main>
  );
}
