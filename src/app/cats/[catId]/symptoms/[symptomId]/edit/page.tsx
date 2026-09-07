import { notFound } from "next/navigation";
import { getCatById } from "@/features/cats/queries";
import { updateSymptomAction } from "@/features/symptoms/actions";
import { getSymptomById } from "@/features/symptoms/queries";
import { SymptomForm } from "@/features/symptoms/SymptomForm";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditSymptomPageProps = {
  params: Promise<{ catId: string; symptomId: string }>;
};

export default async function EditSymptomPage({
  params,
}: EditSymptomPageProps) {
  const { catId, symptomId } = await params;
  const [cat, symptom] = await Promise.all([
    getCatById(catId),
    getSymptomById(symptomId),
  ]);

  if (!cat || !symptom || symptom.catId !== catId) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <h1>{cat.name}の症状記録を編集する</h1>
      <SymptomForm
        action={updateSymptomAction.bind(null, catId, symptom.id)}
        symptom={symptom}
        submitLabel="更新する"
      />
    </main>
  );
}
