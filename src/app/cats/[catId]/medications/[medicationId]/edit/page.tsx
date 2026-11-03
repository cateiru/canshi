import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { MedicationIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { listHospitalVisits } from "@/features/hospital-visits/infrastructure/queries";
import { resolveMediaLimits } from "@/features/media/domain/limits";
import { toMediaAssetView } from "@/features/media/domain/view";
import { listMediaAssetsByRecord } from "@/features/media/infrastructure/queries";
import { MEDICATION_MEDIA_TYPE } from "@/features/medications/domain/media";
import { getMedicationById } from "@/features/medications/infrastructure/queries";
import { updateMedicationAction } from "@/features/medications/presentation/actions";
import { MedicationForm } from "@/features/medications/presentation/MedicationForm";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { listSymptoms } from "@/features/symptoms/infrastructure/queries";
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
    getAccessibleCat(catId),
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

      <RecordPageHeading icon={MedicationIcon}>
        {cat.name}の服薬予定を編集する
      </RecordPageHeading>
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
