import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { SymptomIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { listHospitalVisits } from "@/features/hospital-visits/infrastructure/queries";
import { resolveMediaLimits } from "@/features/media/domain/limits";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import {
  createSymptomAction,
  updateSymptomAction,
} from "@/features/symptoms/presentation/actions";
import { SymptomForm } from "@/features/symptoms/presentation/SymptomForm";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

type NewSymptomPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function NewSymptomPage({ params }: NewSymptomPageProps) {
  const { catId } = await params;
  const cat = await getAccessibleCat(catId);

  if (!cat) {
    notFound();
  }

  const hospitalVisitList = await listHospitalVisits(catId);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ねこ一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "症状記録", href: `/cats/${catId}/symptoms` },
          { label: "記録する" },
        ]}
      />

      <RecordPageHeading icon={SymptomIcon}>
        {cat.name}の症状を記録する
      </RecordPageHeading>
      <SymptomForm
        catId={catId}
        action={createSymptomAction.bind(null, catId)}
        updateAction={updateSymptomAction.bind(null, catId)}
        hospitalVisits={hospitalVisitList}
        mediaLimits={resolveMediaLimits()}
        submitLabel="記録する"
      />
    </main>
  );
}
