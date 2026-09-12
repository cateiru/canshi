import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { MedicationIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById } from "@/features/cats/queries";
import { createMedicationDoseAction } from "@/features/medications/doseActions";
import { MedicationDoseForm } from "@/features/medications/MedicationDoseForm";
import { getMedicationById } from "@/features/medications/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

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
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "服薬予定", href: `/cats/${catId}/medications` },
          {
            label: "投薬実績",
            href: `/cats/${catId}/medications/${medicationId}/doses`,
          },
          { label: "記録する" },
        ]}
      />

      <RecordPageHeading icon={MedicationIcon}>
        {medication.name}の投薬実績を記録する
      </RecordPageHeading>
      <MedicationDoseForm
        action={createMedicationDoseAction.bind(null, catId, medicationId)}
        submitLabel="記録する"
      />
    </main>
  );
}
