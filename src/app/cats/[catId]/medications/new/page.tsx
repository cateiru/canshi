import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { listHospitalVisits } from "@/features/hospital-visits/queries";
import { resolveMediaLimits } from "@/features/media/limits";
import {
  createMedicationAction,
  updateMedicationAction,
} from "@/features/medications/actions";
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
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "服薬予定", href: `/cats/${catId}/medications` },
          { label: "登録する" },
        ]}
      />

      <h1>{cat.name}の服薬予定を登録する</h1>
      <MedicationForm
        catId={catId}
        action={createMedicationAction.bind(null, catId)}
        updateAction={updateMedicationAction.bind(null, catId)}
        symptoms={symptomList}
        hospitalVisits={hospitalVisitList}
        mediaLimits={resolveMediaLimits()}
        submitLabel="登録する"
      />
    </main>
  );
}
