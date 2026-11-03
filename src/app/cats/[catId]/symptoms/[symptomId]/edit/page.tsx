import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { SymptomIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { listHospitalVisits } from "@/features/hospital-visits/infrastructure/queries";
import { resolveMediaLimits } from "@/features/media/domain/limits";
import { toMediaAssetView } from "@/features/media/domain/view";
import { listMediaAssetsByRecord } from "@/features/media/infrastructure/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { SYMPTOM_MEDIA_TYPE } from "@/features/symptoms/domain/media";
import { getSymptomById } from "@/features/symptoms/infrastructure/queries";
import { updateSymptomAction } from "@/features/symptoms/presentation/actions";
import { SymptomForm } from "@/features/symptoms/presentation/SymptomForm";
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
    getAccessibleCat(catId),
    getSymptomById(symptomId),
  ]);

  if (!cat || !symptom || symptom.catId !== catId) {
    notFound();
  }

  const [hospitalVisitList, mediaAssets] = await Promise.all([
    listHospitalVisits(catId),
    listMediaAssetsByRecord(SYMPTOM_MEDIA_TYPE, symptom.id),
  ]);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "症状記録", href: `/cats/${catId}/symptoms` },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={SymptomIcon}>
        {cat.name}の症状記録を編集する
      </RecordPageHeading>
      <SymptomForm
        catId={catId}
        action={updateSymptomAction.bind(null, catId, symptom.id)}
        hospitalVisits={hospitalVisitList}
        symptom={symptom}
        mediaAssets={mediaAssets.map(toMediaAssetView)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="更新する"
      />
    </main>
  );
}
