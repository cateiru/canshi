import { Badge, ButtonLink } from "@/components/ui";
import { MediaThumbnailStrip } from "@/features/media/MediaThumbnailStrip";
import { CONSISTENCY_LABEL } from "@/features/poop-records/labels";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { STATUS_LABEL } from "@/features/symptoms/labels";
import { SUBJECTIVE_AMOUNT_LABEL } from "@/features/water-records/labels";
import { TIMELINE_TYPE_ICON, TIMELINE_TYPE_LABEL } from "./labels";
import type { TimelineEntry } from "./queries";
import styles from "./TimelineEntryCard.module.css";

type TimelineEntryCardProps = {
  catId: string;
  entry: TimelineEntry;
  isFirst: boolean;
  isLast: boolean;
};

export function TimelineEntryCard({
  catId,
  entry,
  isFirst,
  isLast,
}: TimelineEntryCardProps) {
  const Icon = TIMELINE_TYPE_ICON[entry.type];

  return (
    <div className={styles.row}>
      <div className={styles.rail} aria-hidden="true">
        <span
          className={styles.railLine}
          data-hidden={isFirst ? "true" : undefined}
        />
        <span className={styles.dot}>
          <Icon />
        </span>
        <span
          className={styles.railLine}
          data-hidden={isLast ? "true" : undefined}
        />
      </div>
      <div className={styles.card}>
        <div className={styles.header}>
          <Badge color="accent">{TIMELINE_TYPE_LABEL[entry.type]}</Badge>
          <span className={styles.occurredAt}>
            {formatDateTimeUtc(entry.occurredAt)}
          </span>
        </div>
        {entry.media.length > 0 ? (
          <div className={styles.media}>
            <MediaThumbnailStrip
              assets={entry.media}
              title={`${TIMELINE_TYPE_LABEL[entry.type]}の添付`}
            />
          </div>
        ) : null}
        {renderBody(catId, entry)}
      </div>
    </div>
  );
}

function renderBody(catId: string, entry: TimelineEntry) {
  switch (entry.type) {
    case "feeding": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          {record.items.map((item) => (
            <p key={item.id}>
              {item.foodProductName} 推定{item.estimatedIntakeG}g（
              {item.estimatedKcal.toFixed(1)}kcal）
            </p>
          ))}
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
            {CONSISTENCY_LABEL[record.consistency]}
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
            {[
              record.hasBlood ? "血液あり" : null,
              record.hasForeignObject ? "異物あり" : null,
            ]
              .filter(Boolean)
              .join("・")}
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
    case "water": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>
            {record.estimatedIntakeMl != null
              ? `推定飲水量 ${record.estimatedIntakeMl}ml${
                  record.hasSpill ? "（こぼれあり・参考値）" : ""
                }`
              : `給水量 ${record.suppliedAmountMl}ml`}
            {record.subjectiveAmount
              ? `・${SUBJECTIVE_AMOUNT_LABEL[record.subjectiveAmount]}`
              : ""}
          </p>
          <ButtonLink
            href={`/cats/${catId}/water-records/${record.id}/edit`}
            variant="secondary"
          >
            編集する
          </ButtonLink>
        </div>
      );
    }
    case "shampoo": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          {record.memo ? <p>{record.memo}</p> : null}
          <ButtonLink
            href={`/cats/${catId}/shampoo-records/${record.id}/edit`}
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
    case "catPhoto": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          {record.memo ? <p>{record.memo}</p> : null}
          <ButtonLink
            href={`/cats/${catId}/photos/${record.id}/edit`}
            variant="secondary"
          >
            編集する
          </ButtonLink>
        </div>
      );
    }
    default: {
      const exhaustiveCheck: never = entry;
      return exhaustiveCheck;
    }
  }
}
