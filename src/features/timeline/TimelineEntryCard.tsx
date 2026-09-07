import { Badge, ButtonLink, Card } from "@/components/ui";
import { CONSISTENCY_LABEL } from "@/features/poop-records/labels";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { STATUS_LABEL } from "@/features/symptoms/labels";
import { TIMELINE_TYPE_LABEL } from "./labels";
import type { TimelineEntry } from "./queries";
import styles from "./TimelineEntryCard.module.css";

type TimelineEntryCardProps = {
  catId: string;
  entry: TimelineEntry;
};

export function TimelineEntryCard({ catId, entry }: TimelineEntryCardProps) {
  return (
    <Card>
      <div className={styles.header}>
        <Badge color="accent">{TIMELINE_TYPE_LABEL[entry.type]}</Badge>
        <span className={styles.occurredAt}>
          {formatDateTimeUtc(entry.occurredAt)}
        </span>
      </div>
      {renderBody(catId, entry)}
    </Card>
  );
}

function renderBody(catId: string, entry: TimelineEntry) {
  switch (entry.type) {
    case "feeding": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>
            {record.foodProductName} 推定{record.estimatedIntakeG}g（
            {record.estimatedKcal.toFixed(1)}kcal）
          </p>
          <ButtonLink
            href={`/cats/${catId}/feeding-records/${record.id}/edit`}
            variant="secondary"
          >
            編集する
          </ButtonLink>
        </div>
      );
    }
    case "poop": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>
            {record.count}回 {CONSISTENCY_LABEL[record.consistency]}
            {record.hasBlood ? "・血液あり" : ""}
            {record.hasForeignObject ? "・異物あり" : ""}
          </p>
          <ButtonLink
            href={`/cats/${catId}/poop-records/${record.id}/edit`}
            variant="secondary"
          >
            編集する
          </ButtonLink>
        </div>
      );
    }
    case "weight": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>{record.catWeightKg.toFixed(2)} kg</p>
          <ButtonLink
            href={`/cats/${catId}/weight-records/${record.id}/edit`}
            variant="secondary"
          >
            編集する
          </ButtonLink>
        </div>
      );
    }
    case "vomit": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>
            {record.count}回{record.hasBlood ? "・血液あり" : ""}
            {record.hasForeignObject ? "・異物あり" : ""}
          </p>
          <ButtonLink
            href={`/cats/${catId}/vomit-records/${record.id}/edit`}
            variant="secondary"
          >
            編集する
          </ButtonLink>
        </div>
      );
    }
    case "symptom": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>
            {record.symptomType}（{STATUS_LABEL[record.status]}）
          </p>
          <div className={styles.actions}>
            <ButtonLink
              href={`/cats/${catId}/symptoms/${record.id}/edit`}
              variant="secondary"
            >
              編集する
            </ButtonLink>
            {record.hospitalVisitId ? (
              <ButtonLink
                href={`/cats/${catId}/hospital-visits/${record.hospitalVisitId}/edit`}
                variant="secondary"
              >
                関連する通院記録
              </ButtonLink>
            ) : null}
          </div>
        </div>
      );
    }
    case "medicationDose": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>
            {record.medicationName}（
            {record.wasAdministered ? "投薬できた" : "投薬できなかった"}）
          </p>
          <ButtonLink
            href={`/cats/${catId}/medications/${record.medicationId}/doses/${record.id}/edit`}
            variant="secondary"
          >
            編集する
          </ButtonLink>
        </div>
      );
    }
    case "hospitalVisit": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>{record.reason}</p>
          <div className={styles.actions}>
            <ButtonLink
              href={`/cats/${catId}/hospital-visits/${record.id}/edit`}
              variant="secondary"
            >
              編集する
            </ButtonLink>
            {record.symptomId ? (
              <ButtonLink
                href={`/cats/${catId}/symptoms/${record.symptomId}/edit`}
                variant="secondary"
              >
                関連する症状記録
              </ButtonLink>
            ) : null}
          </div>
        </div>
      );
    }
    default: {
      const exhaustiveCheck: never = entry;
      return exhaustiveCheck;
    }
  }
}
