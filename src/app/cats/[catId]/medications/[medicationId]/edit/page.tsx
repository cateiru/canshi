import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { listHospitalVisits } from "@/features/hospital-visits/queries";
import { updateMedicationAction } from "@/features/medications/actions";
import { MedicationForm } from "@/features/medications/MedicationForm";
import { getMedicationById } from "@/features/medications/queries";
import { listSymptoms } from "@/features/symptoms/queries";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditMedicationPageProps = {
  params: Promise<{ catId: string; medicationId: string }>;
};

export default async function EditMedicationPage({
  params,
}: EditMedicationPageProps) {
  const { catId, medicationId } = await params;
  const [cat, medication] = await Promise.all([
    getCatById(catId),
    getMedicationById(medicationId),
  ]);

  if (!cat || !medication || medication.catId !== catId) {
    notFound();
  }

  const [symptomList, hospitalVisitList] = await Promise.all([
    listSymptoms(catId),
    listHospitalVisits(catId),
  ]);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "服薬予定", href: `/cats/${catId}/medications` },
          { label: "編集する" },
        ]}
      />

      <h1>{cat.name}の服薬予定を編集する</h1>
      <MedicationForm
        action={updateMedicationAction.bind(null, catId, medication.id)}
        symptoms={symptomList}
        hospitalVisits={hospitalVisitList}
        medication={medication}
        submitLabel="更新する"
      />
    </main>
  );
}
