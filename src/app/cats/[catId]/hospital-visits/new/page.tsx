import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import {
  createHospitalVisitAction,
  updateHospitalVisitAction,
} from "@/features/hospital-visits/actions";
import { HospitalVisitForm } from "@/features/hospital-visits/HospitalVisitForm";
import { resolveMediaLimits } from "@/features/media/limits";
import { listSymptoms } from "@/features/symptoms/queries";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewHospitalVisitPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewHospitalVisitPage({
  params,
}: NewHospitalVisitPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
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
          { label: "記録する" },
        ]}
      />

      <h1>{cat.name}の通院を記録する</h1>
      <HospitalVisitForm
        catId={catId}
        action={createHospitalVisitAction.bind(null, catId)}
        updateAction={updateHospitalVisitAction.bind(null, catId)}
        symptoms={symptomList}
        mediaLimits={resolveMediaLimits()}
        submitLabel="記録する"
      />
    </main>
  );
}
