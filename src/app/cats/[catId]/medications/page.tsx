import { notFound } from "next/navigation";
import { RiCapsuleFill } from "react-icons/ri";
import { Breadcrumb, ButtonLink, Card } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { hospitalVisitOptionLabel } from "@/features/hospital-visits/labels";
import { listHospitalVisits } from "@/features/hospital-visits/queries";
import { MediaGallery } from "@/features/media/MediaGallery";
import { listMediaAssetsByRecords } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
import { deleteMedicationAction } from "@/features/medications/actions";
import { MEDICATION_MEDIA_TYPE } from "@/features/medications/media";
import { listMedications } from "@/features/medications/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { listSymptoms } from "@/features/symptoms/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type MedicationsPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function MedicationsPage({
  params,
}: MedicationsPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const [medicationList, symptomList, hospitalVisitList] = await Promise.all([
    listMedications(catId),
    listSymptoms(catId),
    listHospitalVisits(catId),
  ]);
  const mediaByRecordId = await listMediaAssetsByRecords(
    MEDICATION_MEDIA_TYPE,
    medicationList.map((medication) => medication.id),
  );
  const symptomNameById = new Map(
    symptomList.map((symptom) => [symptom.id, symptom.symptomType]),
  );
  const hospitalVisitLabelById = new Map(
    hospitalVisitList.map((visit) => [
      visit.id,
      hospitalVisitOptionLabel(visit),
    ]),
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "服薬予定" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={RiCapsuleFill}>
          {cat.name}の服薬予定
        </RecordPageHeading>
        <ButtonLink href={`/cats/${catId}/medications/new`} variant="primary">
          服薬予定を登録する
        </ButtonLink>
      </div>

      {medicationList.length === 0 ? (
        <Card>
          <p>まだ服薬予定が登録されていません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/medications/new`}
              variant="primary"
            >
              最初の服薬予定を登録する
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {medicationList.map((medication) => (
            <li key={medication.id}>
              <Card title={medication.name}>
                <dl className={styles.details}>
                  <dt>1回量</dt>
                  <dd>{medication.doseAmount}</dd>
                  <dt>1日の回数</dt>
                  <dd>{medication.dosesPerDay}回</dd>
                  <dt>服用期間</dt>
                  <dd>
                    {medication.startDate} 〜 {medication.endDate ?? "終了未定"}
                  </dd>
                  {medication.symptomId ? (
                    <>
                      <dt>関連する症状</dt>
                      <dd>
                        {symptomNameById.get(medication.symptomId) ??
                          "不明な症状"}
                      </dd>
                    </>
                  ) : null}
                  {medication.hospitalVisitId ? (
                    <>
                      <dt>処方元の通院記録</dt>
                      <dd>
                        {hospitalVisitLabelById.get(
                          medication.hospitalVisitId,
                        ) ?? "不明な通院記録"}
                      </dd>
                    </>
                  ) : null}
                </dl>
                <MediaGallery
                  assets={(mediaByRecordId.get(medication.id) ?? []).map(
                    toMediaAssetView,
                  )}
                  title="処方箋・薬袋の写真"
                  fit="actual"
                />
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/cats/${catId}/medications/${medication.id}/doses`}
                    variant="primary"
                  >
                    投薬実績
                  </ButtonLink>
                  <ButtonLink
                    href={`/cats/${catId}/medications/${medication.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteRecordButton
                    action={deleteMedicationAction.bind(
                      null,
                      catId,
                      medication.id,
                    )}
                    title="服薬予定の削除"
                    description="この服薬予定を削除しますか？関連する投薬実績も参照できなくなります。"
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
