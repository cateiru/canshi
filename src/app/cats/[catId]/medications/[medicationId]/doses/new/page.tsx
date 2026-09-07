import { notFound } from "next/navigation";
import { getCatById } from "@/features/cats/queries";
import { createMedicationDoseAction } from "@/features/medications/doseActions";
import { MedicationDoseForm } from "@/features/medications/MedicationDoseForm";
import { getMedicationById } from "@/features/medications/queries";
import styles from "../page.module.css";

type NewMedicationDosePageProps = {
  params: Promise<{ catId: string; medicationId: string }>;
};

export default async function NewMedicationDosePage({
  params,
}: NewMedicationDosePageProps) {
  const { catId, medicationId } = await params;
  const [cat, medication] = await Promise.all([
    getCatById(catId),
    getMedicationById(medicationId),
  ]);

  if (!cat || !medication || medication.catId !== catId) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <h1>{medication.name}の投薬実績を記録する</h1>
      <MedicationDoseForm
        action={createMedicationDoseAction.bind(null, catId, medicationId)}
        submitLabel="記録する"
      />
    </main>
  );
}
