import { notFound } from "next/navigation";
import { TbActivity, TbPencil, TbPlus } from "react-icons/tb";
import {
  Breadcrumb,
  ButtonLink,
  Collapsible,
  IconButtonLink,
  RecordCard,
  RecordEmptyState,
} from "@/components/ui";
import { MedicationIcon } from "@/components/ui/RecordIcons/RecordIcons";
import type { Medication } from "@/db/schema";
import { getAccessibleCat } from "@/features/auth/session";
import { hospitalVisitOptionLabel } from "@/features/hospital-visits/labels";
import { listHospitalVisits } from "@/features/hospital-visits/queries";
import { MediaGallery } from "@/features/media/MediaGallery";
import { listMediaAssetsByRecords } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
import {
  archiveMedicationAction,
  deleteMedicationAction,
  unarchiveMedicationAction,
} from "@/features/medications/actions";
import {
  getMedicationToday,
  isMedicationEnded,
  partitionMedications,
} from "@/features/medications/history";
import { MedicationHistoryButton } from "@/features/medications/MedicationHistoryButton";
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
  const cat = await getAccessibleCat(catId);

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
  const today = getMedicationToday();
  const { current, history } = partitionMedications(medicationList, today);
  const cardProps = {
    catId,
    today,
    symptomNameById,
    hospitalVisitLabelById,
    mediaByRecordId,
  };

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "服薬予定" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={MedicationIcon}>
          {cat.name}の服薬予定
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/medications/new`}
          variant="primary"
          className={styles.createButton}
          leftIcon={TbPlus}
        >
          服薬予定を登録する
        </ButtonLink>
      </div>

      {medicationList.length === 0 ? (
        <RecordEmptyState
          icon={MedicationIcon}
          actions={
            <ButtonLink
              href={`/cats/${catId}/medications/new`}
              variant="primary"
              className={styles.createButton}
            >
              最初の服薬予定を登録する
            </ButtonLink>
          }
        >
          まだ服薬予定が登録されていません。
        </RecordEmptyState>
      ) : (
        <>
          {current.length === 0 ? (
            <RecordEmptyState icon={MedicationIcon}>
              服用中の薬はありません。
            </RecordEmptyState>
          ) : (
            <ul className={styles.list}>
              {current.map((medication) => (
                <li key={medication.id}>
                  <MedicationCard medication={medication} {...cardProps} />
                </li>
              ))}
            </ul>
          )}

          {history.length > 0 ? (
            <Collapsible
              title="服薬歴"
              titleAside={`${history.length}件`}
              defaultExpanded={false}
              storageKey="canshi:medication-history-expanded"
            >
              <ul className={styles.list}>
                {history.map((medication) => (
                  <li key={medication.id}>
                    <MedicationCard
                      medication={medication}
                      {...cardProps}
                      headingLevel={3}
                      className={styles.historyCard}
                    />
                  </li>
                ))}
              </ul>
            </Collapsible>
          ) : null}
        </>
      )}
    </main>
  );
}

type MedicationCardProps = {
  medication: Medication;
  catId: string;
  today: string;
  symptomNameById: Map<string, string>;
  hospitalVisitLabelById: Map<string, string>;
  mediaByRecordId: Awaited<ReturnType<typeof listMediaAssetsByRecords>>;
  /** 服薬歴（Collapsible の見出しの下）に置くときは 3 にする */
  headingLevel?: 2 | 3;
  className?: string;
};

function MedicationCard({
  medication,
  catId,
  today,
  symptomNameById,
  hospitalVisitLabelById,
  mediaByRecordId,
  headingLevel = 2,
  className,
}: MedicationCardProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const isEnded = isMedicationEnded(medication, today);
  const isArchived = medication.archivedAt != null;

  return (
    <RecordCard aria-label={medication.name} className={className}>
      <div className={styles.recordHeader}>
        <Heading className={styles.recordTitle}>{medication.name}</Heading>
        <div className={styles.cardActions}>
          <IconButtonLink
            href={`/cats/${catId}/medications/${medication.id}/edit`}
            icon={TbPencil}
            aria-label="編集する"
            title="編集する"
          />
          <DeleteRecordButton
            action={deleteMedicationAction.bind(null, catId, medication.id)}
            title="服薬予定の削除"
            description="この服薬予定を削除しますか？関連する投薬実績も参照できなくなります。"
            iconOnly
          />
        </div>
      </div>

      <dl className={styles.details}>
        <div>
          <dt>1回量</dt>
          <dd>{medication.doseAmount}</dd>
        </div>
        <div>
          <dt>1日の回数</dt>
          <dd>{medication.dosesPerDay}回</dd>
        </div>
        <div>
          <dt>服用期間</dt>
          <dd>
            {medication.startDate} 〜 {medication.endDate ?? "終了未定"}
          </dd>
        </div>
        {medication.archivedAt ? (
          <div>
            <dt>服薬歴に移した日</dt>
            {/* 保存値は JST の見た目の数字をそのまま UTC にしたもの */}
            <dd>{medication.archivedAt.toISOString().slice(0, 10)}</dd>
          </div>
        ) : null}
        {medication.symptomId ? (
          <div>
            <dt>関連する症状</dt>
            <dd>{symptomNameById.get(medication.symptomId) ?? "不明な症状"}</dd>
          </div>
        ) : null}
        {medication.hospitalVisitId ? (
          <div>
            <dt>処方元の通院記録</dt>
            <dd>
              {hospitalVisitLabelById.get(medication.hospitalVisitId) ??
                "不明な通院記録"}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.media}>
        <MediaGallery
          assets={(mediaByRecordId.get(medication.id) ?? []).map(
            toMediaAssetView,
          )}
          title="処方箋・薬袋の写真"
          fit="actual"
        />
      </div>

      {isEnded ? (
        <p className={styles.historyNote}>
          終了予定日を過ぎたため服薬歴に表示しています。服薬予定に戻すには終了予定日を変更してください。
        </p>
      ) : null}

      <div className={styles.primaryAction}>
        <ButtonLink
          href={`/cats/${catId}/medications/${medication.id}/doses`}
          variant="primary"
          leftIcon={TbActivity}
        >
          投薬実績を見る
        </ButtonLink>
        {isEnded ? null : isArchived ? (
          <MedicationHistoryButton
            action={unarchiveMedicationAction.bind(null, catId, medication.id)}
            kind="unarchive"
          />
        ) : (
          <MedicationHistoryButton
            action={archiveMedicationAction.bind(null, catId, medication.id)}
            kind="archive"
          />
        )}
      </div>
    </RecordCard>
  );
}
