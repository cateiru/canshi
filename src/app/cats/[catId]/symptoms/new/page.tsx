import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { listHospitalVisits } from "@/features/hospital-visits/queries";
import { createSymptomAction } from "@/features/symptoms/actions";
import { SymptomForm } from "@/features/symptoms/SymptomForm";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewSymptomPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewSymptomPage({ params }: NewSymptomPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
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
          { label: "記録する" },
        ]}
      />

      <h1>{cat.name}の症状を記録する</h1>
      <SymptomForm
        action={createSymptomAction.bind(null, catId)}
        hospitalVisits={hospitalVisitList}
        submitLabel="記録する"
      />
    </main>
  );
}
