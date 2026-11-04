import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { MedicationIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { getMedicationDoseById } from "@/features/medications/infrastructure/doseQueries";
import { getMedicationById } from "@/features/medications/infrastructure/queries";
import { updateMedicationDoseAction } from "@/features/medications/presentation/doseActions";
import { MedicationDoseForm } from "@/features/medications/presentation/MedicationDoseForm";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditMedicationDosePageProps = {
  params: Promise<{ catId: string; medicationId: string; doseId: string }>;
};

export default async function EditMedicationDosePage({
  params,
}: EditMedicationDosePageProps) {
  const { catId, medicationId, doseId } = await params;
  const [cat, medication, dose] = await Promise.all([
    getAccessibleCat(catId),
    getMedicationById(medicationId),
    getMedicationDoseById(doseId),
  ]);

  if (
    !cat ||
    !medication ||
    medication.catId !== catId ||
    !dose ||
    dose.medicationId !== medicationId
  ) {
    notFound();
  }

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ねこ一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "服薬予定", href: `/cats/${catId}/medications` },
          {
            label: "投薬実績",
            href: `/cats/${catId}/medications/${medicationId}/doses`,
          },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={MedicationIcon}>
        {medication.name}の投薬実績を編集する
      </RecordPageHeading>
      <MedicationDoseForm
        action={updateMedicationDoseAction.bind(
          null,
          catId,
          medicationId,
          dose.id,
        )}
        medicationDose={dose}
        submitLabel="更新する"
      />
    </main>
  );
}
