import { notFound } from "next/navigation";
import { TbClock, TbPencil, TbPlus, TbTemperature } from "react-icons/tb";
import { Badge, Breadcrumb, ButtonLink } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { hospitalVisitOptionLabel } from "@/features/hospital-visits/labels";
import { listHospitalVisits } from "@/features/hospital-visits/queries";
import { MediaGallery } from "@/features/media/MediaGallery";
import { listMediaAssetsByRecords } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { deleteSymptomAction } from "@/features/symptoms/actions";
import { STATUS_LABEL } from "@/features/symptoms/labels";
import { SYMPTOM_MEDIA_TYPE } from "@/features/symptoms/media";
import { listSymptoms } from "@/features/symptoms/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const STATUS_BADGE_COLOR = {
  ongoing: "warning",
  improving: "info",
  resolved: "success",
} as const;

type SymptomsPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function SymptomsPage({ params }: SymptomsPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const [records, hospitalVisitList] = await Promise.all([
    listSymptoms(catId),
    listHospitalVisits(catId),
  ]);
  const mediaByRecordId = await listMediaAssetsByRecords(
    SYMPTOM_MEDIA_TYPE,
    records.map((record) => record.id),
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
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "症状記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={TbTemperature}>
          {cat.name}の症状記録
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/symptoms/new`}
          variant="primary"
          className={styles.createButton}
        >
          <TbPlus aria-hidden="true" size={18} />
          記録する
        </ButtonLink>
      </div>

      {records.length === 0 ? (
        <div className={styles.emptyState}>
          <TbTemperature aria-hidden="true" size={32} />
          <p>まだ症状記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/symptoms/new`}
              variant="primary"
              className={styles.createButton}
            >
              最初の記録をする
            </ButtonLink>
          </div>
        </div>
      ) : (
        <ul className={styles.list}>
          {records.map((record) => (
            <li key={record.id}>
              <article
                className={styles.record}
                aria-label={record.symptomType}
              >
                <div className={styles.recordHeader}>
                  <div className={styles.titleGroup}>
                    <h2 className={styles.recordTitle}>{record.symptomType}</h2>
                    <Badge color={STATUS_BADGE_COLOR[record.status]}>
                      {STATUS_LABEL[record.status]}
                    </Badge>
                  </div>
                  <div className={styles.cardActions}>
                    <ButtonLink
                      href={`/cats/${catId}/symptoms/${record.id}/edit`}
                      variant="secondary"
                      className={styles.iconButton}
                      aria-label="編集する"
                      title="編集する"
                    >
                      <TbPencil aria-hidden="true" size={20} />
                    </ButtonLink>
                    <DeleteRecordButton
                      action={deleteSymptomAction.bind(null, catId, record.id)}
                      title="症状記録の削除"
                      description="この症状記録を削除しますか？この操作は取り消せません。"
                      iconOnly
                      className={styles.iconButton}
                    />
                  </div>
                </div>

                <p className={styles.meta}>
                  <TbClock aria-hidden="true" size={16} />
                  <time dateTime={record.onsetAt.toISOString()}>
                    {formatDateTimeUtc(record.onsetAt)}
                  </time>
                </p>

                <dl className={styles.details}>
                  {record.frequencyOrSeverity ? (
                    <div>
                      <dt>回数・程度</dt>
                      <dd>{record.frequencyOrSeverity}</dd>
                    </div>
                  ) : null}
                  {record.appetiteNote ? (
                    <div>
                      <dt>食欲</dt>
                      <dd>{record.appetiteNote}</dd>
                    </div>
                  ) : null}
                  {record.energyNote ? (
                    <div>
                      <dt>元気</dt>
                      <dd>{record.energyNote}</dd>
                    </div>
                  ) : null}
                  {record.hospitalVisitId ? (
                    <div>
                      <dt>関連する通院記録</dt>
                      <dd>
                        {hospitalVisitLabelById.get(record.hospitalVisitId) ??
                          "不明な通院記録"}
                      </dd>
                    </div>
                  ) : null}
                  {record.memo ? (
                    <div>
                      <dt>備考</dt>
                      <dd>{record.memo}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className={styles.media}>
                  <MediaGallery
                    assets={(mediaByRecordId.get(record.id) ?? []).map(
                      toMediaAssetView,
                    )}
                    title="症状の写真・動画"
                  />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
