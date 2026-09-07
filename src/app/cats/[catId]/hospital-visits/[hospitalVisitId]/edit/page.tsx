import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { updateHospitalVisitAction } from "@/features/hospital-visits/actions";
import { HospitalVisitForm } from "@/features/hospital-visits/HospitalVisitForm";
import { getHospitalVisitById } from "@/features/hospital-visits/queries";
import { listSymptoms } from "@/features/symptoms/queries";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type EditHospitalVisitPageProps = {
  params: Promise<{ catId: string; hospitalVisitId: string }>;
};

export default async function EditHospitalVisitPage({
  params,
}: EditHospitalVisitPageProps) {
  const { catId, hospitalVisitId } = await params;
  const [cat, hospitalVisit] = await Promise.all([
    getCatById(catId),
    getHospitalVisitById(hospitalVisitId),
  ]);

  if (!cat || !hospitalVisit || hospitalVisit.catId !== catId) {
    notFound();
  }

  const symptomList = await listSymptoms(catId);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "通院記録", href: `/cats/${catId}/hospital-visits` },
          { label: "編集する" },
        ]}
      />

      <h1>{cat.name}の通院記録を編集する</h1>
      <HospitalVisitForm
        action={updateHospitalVisitAction.bind(null, catId, hospitalVisit.id)}
        symptoms={symptomList}
        hospitalVisit={hospitalVisit}
        submitLabel="更新する"
      />
    </main>
  );
}
