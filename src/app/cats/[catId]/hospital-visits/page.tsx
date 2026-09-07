import Link from "next/link";
import { notFound } from "next/navigation";
import { TbBuildingHospital } from "react-icons/tb";
import { ButtonLink, Card } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { deleteHospitalVisitAction } from "@/features/hospital-visits/actions";
import { listHospitalVisits } from "@/features/hospital-visits/queries";
import { listMedicationsByHospitalVisitIds } from "@/features/medications/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { listSymptoms } from "@/features/symptoms/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type HospitalVisitsPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function HospitalVisitsPage({
  params,
}: HospitalVisitsPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const [visits, symptomList] = await Promise.all([
    listHospitalVisits(catId),
    listSymptoms(catId),
  ]);
  const symptomNameById = new Map(
    symptomList.map((symptom) => [symptom.id, symptom.symptomType]),
  );
  const prescribedMedicationsByVisit = await listMedicationsByHospitalVisitIds(
    catId,
    visits.map((visit) => visit.id),
  );

  return (
    <main className={styles.main}>
      <Link href={`/cats/${catId}`} className={styles.backLink}>
        ← {cat.name}のページに戻る
      </Link>

      <div className={styles.header}>
        <RecordPageHeading icon={TbBuildingHospital}>
          {cat.name}の通院記録
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/hospital-visits/new`}
          variant="primary"
        >
          記録する
        </ButtonLink>
      </div>

      {visits.length === 0 ? (
        <Card>
          <p>まだ通院記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/hospital-visits/new`}
              variant="primary"
            >
              最初の記録をする
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {visits.map((visit) => {
            const prescribedMedications =
              prescribedMedicationsByVisit.get(visit.id) ?? [];
            return (
              <li key={visit.id}>
                <Card title={visit.reason}>
                  <dl className={styles.details}>
                    <dt>受診日時</dt>
                    <dd>{formatDateTimeUtc(visit.visitedAt)}</dd>
                    {visit.reservedAt ? (
                      <>
                        <dt>予約日時</dt>
                        <dd>{formatDateTimeUtc(visit.reservedAt)}</dd>
                      </>
                    ) : null}
                    {visit.symptomId ? (
                      <>
                        <dt>関連する症状</dt>
                        <dd>
                          {symptomNameById.get(visit.symptomId) ?? "不明な症状"}
                        </dd>
                      </>
                    ) : null}
                    {visit.diagnosis ? (
                      <>
                        <dt>診断・所見</dt>
                        <dd>{visit.diagnosis}</dd>
                      </>
                    ) : null}
                    {visit.examinationResults ? (
                      <>
                        <dt>検査と結果</dt>
                        <dd>{visit.examinationResults}</dd>
                      </>
                    ) : null}
                    {visit.treatment ? (
                      <>
                        <dt>注射・処置</dt>
                        <dd>{visit.treatment}</dd>
                      </>
                    ) : null}
                    {prescribedMedications.length > 0 ? (
                      <>
                        <dt>処方薬</dt>
                        <dd>
                          {prescribedMedications
                            .map((medication) => medication.name)
                            .join("、")}
                        </dd>
                      </>
                    ) : null}
                    {visit.nextVisitAt ? (
                      <>
                        <dt>次回受診予定</dt>
                        <dd>{formatDateTimeUtc(visit.nextVisitAt)}</dd>
                      </>
                    ) : null}
                    {visit.memo ? (
                      <>
                        <dt>備考</dt>
                        <dd>{visit.memo}</dd>
                      </>
                    ) : null}
                  </dl>
                  <div className={styles.cardActions}>
                    <ButtonLink
                      href={`/cats/${catId}/hospital-visits/${visit.id}/edit`}
                      variant="secondary"
                    >
                      編集する
                    </ButtonLink>
                    <DeleteRecordButton
                      action={deleteHospitalVisitAction.bind(
                        null,
                        catId,
                        visit.id,
                      )}
                      title="通院記録の削除"
                      description="この通院記録を削除しますか？この操作は取り消せません。"
                    />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
