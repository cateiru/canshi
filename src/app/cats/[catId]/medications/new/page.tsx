import { notFound } from "next/navigation";
import { getCatById } from "@/features/cats/queries";
import { listHospitalVisits } from "@/features/hospital-visits/queries";
import { createMedicationAction } from "@/features/medications/actions";
import { MedicationForm } from "@/features/medications/MedicationForm";
import { listSymptoms } from "@/features/symptoms/queries";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewMedicationPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewMedicationPage({
  params,
}: NewMedicationPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const [symptomList, hospitalVisitList] = await Promise.all([
    listSymptoms(catId),
    listHospitalVisits(catId),
  ]);

  return (
    <main className={styles.main}>
      <h1>{cat.name}の服薬予定を登録する</h1>
      <MedicationForm
        action={createMedicationAction.bind(null, catId)}
        symptoms={symptomList}
        hospitalVisits={hospitalVisitList}
        submitLabel="登録する"
      />
    </main>
  );
}
