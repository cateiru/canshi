import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { listHospitalVisits } from "@/features/hospital-visits/queries";
import { resolveMediaLimits } from "@/features/media/limits";
import { listMediaAssetsByRecord } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
import { updateMedicationAction } from "@/features/medications/actions";
import { MedicationForm } from "@/features/medications/MedicationForm";
import { MEDICATION_MEDIA_TYPE } from "@/features/medications/media";
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

  const [symptomList, hospitalVisitList, mediaAssets] = await Promise.all([
    listSymptoms(catId),
    listHospitalVisits(catId),
    listMediaAssetsByRecord(MEDICATION_MEDIA_TYPE, medication.id),
  ]);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "服薬予定", href: `/cats/${catId}/medications` },
          { label: "編集する" },
        ]}
      />

      <h1>{cat.name}の服薬予定を編集する</h1>
      <MedicationForm
        catId={catId}
        action={updateMedicationAction.bind(null, catId, medication.id)}
        symptoms={symptomList}
        hospitalVisits={hospitalVisitList}
        medication={medication}
        mediaAssets={mediaAssets.map(toMediaAssetView)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="更新する"
      />
    </main>
  );
}
