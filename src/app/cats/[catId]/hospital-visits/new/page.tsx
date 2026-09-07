import { notFound } from "next/navigation";
import { getCatById } from "@/features/cats/queries";
import { createHospitalVisitAction } from "@/features/hospital-visits/actions";
import { HospitalVisitForm } from "@/features/hospital-visits/HospitalVisitForm";
import { listSymptoms } from "@/features/symptoms/queries";
import styles from "../page.module.css";

type NewHospitalVisitPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewHospitalVisitPage({
  params,
}: NewHospitalVisitPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const symptomList = await listSymptoms(catId);

  return (
    <main className={styles.main}>
      <h1>{cat.name}の通院を記録する</h1>
      <HospitalVisitForm
        action={createHospitalVisitAction.bind(null, catId)}
        symptoms={symptomList}
        submitLabel="記録する"
      />
    </main>
  );
}
