import { notFound } from "next/navigation";
import { TbBuildingHospital, TbClock, TbPencil, TbPlus } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { deleteHospitalVisitAction } from "@/features/hospital-visits/actions";
import { HOSPITAL_VISIT_MEDIA_TYPE } from "@/features/hospital-visits/media";
import { listHospitalVisits } from "@/features/hospital-visits/queries";
import { MediaGallery } from "@/features/media/MediaGallery";
import { listMediaAssetsByRecords } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
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
  const [prescribedMedicationsByVisit, mediaByRecordId] = await Promise.all([
    listMedicationsByHospitalVisitIds(
      catId,
      visits.map((visit) => visit.id),
    ),
    listMediaAssetsByRecords(
      HOSPITAL_VISIT_MEDIA_TYPE,
      visits.map((visit) => visit.id),
    ),
  ]);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "通院記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={TbBuildingHospital}>
          {cat.name}の通院記録
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/hospital-visits/new`}
          variant="primary"
          className={styles.createButton}
        >
          <TbPlus aria-hidden="true" size={18} />
          記録する
        </ButtonLink>
      </div>

      {visits.length === 0 ? (
        <div className={styles.emptyState}>
          <TbBuildingHospital aria-hidden="true" size={32} />
          <p>まだ通院記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/hospital-visits/new`}
              variant="primary"
              className={styles.createButton}
            >
              最初の記録をする
            </ButtonLink>
          </div>
        </div>
      ) : (
        <ul className={styles.list}>
          {visits.map((visit) => {
            const prescribedMedications =
              prescribedMedicationsByVisit.get(visit.id) ?? [];
            return (
              <li key={visit.id}>
                <article className={styles.record} aria-label={visit.reason}>
                  <div className={styles.recordHeader}>
                    <h2 className={styles.recordTitle}>{visit.reason}</h2>
                    <div className={styles.cardActions}>
                      <ButtonLink
                        href={`/cats/${catId}/hospital-visits/${visit.id}/edit`}
                        variant="secondary"
                        className={styles.iconButton}
                        aria-label="編集する"
                        title="編集する"
                      >
                        <TbPencil aria-hidden="true" size={20} />
                      </ButtonLink>
                      <DeleteRecordButton
                        action={deleteHospitalVisitAction.bind(
                          null,
                          catId,
                          visit.id,
                        )}
                        title="通院記録の削除"
                        description="この通院記録を削除しますか？この操作は取り消せません。"
                        iconOnly
                        className={styles.iconButton}
                      />
                    </div>
                  </div>

                  <p className={styles.meta}>
                    <TbClock aria-hidden="true" size={16} />
                    <time dateTime={visit.visitedAt.toISOString()}>
                      {formatDateTimeUtc(visit.visitedAt)}
                    </time>
                  </p>

                  <dl className={styles.details}>
                    {visit.symptomId ? (
                      <div>
                        <dt>関連する症状</dt>
                        <dd>
                          {symptomNameById.get(visit.symptomId) ?? "不明な症状"}
                        </dd>
                      </div>
                    ) : null}
                    {visit.diagnosis ? (
                      <div>
                        <dt>診断・所見</dt>
                        <dd>{visit.diagnosis}</dd>
                      </div>
                    ) : null}
                    {visit.examinationResults ? (
                      <div>
                        <dt>検査と結果</dt>
                        <dd>{visit.examinationResults}</dd>
                      </div>
                    ) : null}
                    {visit.treatment ? (
                      <div>
                        <dt>注射・処置</dt>
                        <dd>{visit.treatment}</dd>
                      </div>
                    ) : null}
                    {prescribedMedications.length > 0 ? (
                      <div>
                        <dt>処方薬</dt>
                        <dd>
                          {prescribedMedications
                            .map((medication) => medication.name)
                            .join("、")}
                        </dd>
                      </div>
                    ) : null}
                    {visit.nextVisitAt ? (
                      <div>
                        <dt>次回受診予定</dt>
                        <dd>{formatDateTimeUtc(visit.nextVisitAt)}</dd>
                      </div>
                    ) : null}
                    {visit.memo ? (
                      <div>
                        <dt>備考</dt>
                        <dd>{visit.memo}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className={styles.media}>
                    <MediaGallery
                      assets={(mediaByRecordId.get(visit.id) ?? []).map(
                        toMediaAssetView,
                      )}
                      title="診療明細などの写真"
                      fit="actual"
                    />
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
