import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { updateMedicationDoseAction } from "@/features/medications/doseActions";
import { getMedicationDoseById } from "@/features/medications/doseQueries";
import { MedicationDoseForm } from "@/features/medications/MedicationDoseForm";
import { getMedicationById } from "@/features/medications/queries";
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
    getCatById(catId),
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
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "服薬予定", href: `/cats/${catId}/medications` },
          {
            label: "投薬実績",
            href: `/cats/${catId}/medications/${medicationId}/doses`,
          },
          { label: "編集する" },
        ]}
      />

      <h1>{medication.name}の投薬実績を編集する</h1>
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
