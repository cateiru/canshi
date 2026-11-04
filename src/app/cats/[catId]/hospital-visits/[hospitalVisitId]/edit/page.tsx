import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { HospitalIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { getExpenseByHospitalVisitId } from "@/features/expenses/infrastructure/queries";
import { HOSPITAL_VISIT_MEDIA_TYPE } from "@/features/hospital-visits/domain/media";
import { getHospitalVisitById } from "@/features/hospital-visits/infrastructure/queries";
import { updateHospitalVisitAction } from "@/features/hospital-visits/presentation/actions";
import { HospitalVisitForm } from "@/features/hospital-visits/presentation/HospitalVisitForm";
import { resolveMediaLimits } from "@/features/media/domain/limits";
import { toMediaAssetView } from "@/features/media/domain/view";
import { listMediaAssetsByRecord } from "@/features/media/infrastructure/queries";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { listSymptoms } from "@/features/symptoms/infrastructure/queries";
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
    getAccessibleCat(catId),
    getHospitalVisitById(hospitalVisitId),
  ]);

  if (!cat || !hospitalVisit || hospitalVisit.catId !== catId) {
    notFound();
  }

  const [symptomList, mediaAssets, expense] = await Promise.all([
    listSymptoms(catId),
    listMediaAssetsByRecord(HOSPITAL_VISIT_MEDIA_TYPE, hospitalVisit.id),
    getExpenseByHospitalVisitId(hospitalVisit.id),
  ]);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ねこ一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "通院記録", href: `/cats/${catId}/hospital-visits` },
          { label: "編集する" },
        ]}
      />

      <RecordPageHeading icon={HospitalIcon}>
        {cat.name}の通院記録を編集する
      </RecordPageHeading>
      <HospitalVisitForm
        catId={catId}
        action={updateHospitalVisitAction.bind(null, catId, hospitalVisit.id)}
        symptoms={symptomList}
        hospitalVisit={hospitalVisit}
        expenseAmountYen={expense?.amountYen ?? null}
        isExpenseShared={(expense?.hospitalVisitIds.length ?? 0) > 1}
        mediaAssets={mediaAssets.map(toMediaAssetView)}
        mediaLimits={resolveMediaLimits()}
        submitLabel="更新する"
      />
    </main>
  );
}
