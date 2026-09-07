import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { listHospitalVisits } from "@/features/hospital-visits/queries";
import { updateSymptomAction } from "@/features/symptoms/actions";
import { getSymptomById } from "@/features/symptoms/queries";
import { SymptomForm } from "@/features/symptoms/SymptomForm";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditSymptomPageProps = {
  params: Promise<{ catId: string; symptomId: string }>;
};

export default async function EditSymptomPage({
  params,
}: EditSymptomPageProps) {
  const { catId, symptomId } = await params;
  const [cat, symptom] = await Promise.all([
    getCatById(catId),
    getSymptomById(symptomId),
  ]);

  if (!cat || !symptom || symptom.catId !== catId) {
    notFound();
  }

  const hospitalVisitList = await listHospitalVisits(catId);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "症状記録", href: `/cats/${catId}/symptoms` },
          { label: "編集する" },
        ]}
      />

      <h1>{cat.name}の症状記録を編集する</h1>
      <SymptomForm
        action={updateSymptomAction.bind(null, catId, symptom.id)}
        hospitalVisits={hospitalVisitList}
        symptom={symptom}
        submitLabel="更新する"
      />
    </main>
  );
}
