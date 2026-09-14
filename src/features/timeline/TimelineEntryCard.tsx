import { Badge, ButtonLink } from "@/components/ui";
import {
  CalorieIcon,
  FeedingIcon,
} from "@/components/ui/RecordIcons/RecordIcons";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
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
  /** ごはん商品のサムネイル URL（商品ID -> URL）。タイムラインのごはん記録の画像表示に使う */
  foodProductImageUrls: Record<string, string>;
};

export function TimelineEntryCard({
  catId,
  entry,
  isFirst,
  isLast,
  foodProductImageUrls,
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
      <article
        className={styles.card}
        aria-label={`${TIMELINE_TYPE_LABEL[entry.type]} ${formatDateTimeUtc(entry.occurredAt)}`}
      >
        <div className={styles.header}>
          <Badge color="accent">{TIMELINE_TYPE_LABEL[entry.type]}</Badge>
          <time
            className={styles.occurredAt}
            dateTime={entry.occurredAt.toISOString()}
          >
            {formatDateTimeUtc(entry.occurredAt)}
          </time>
        </div>
        {entry.media.length > 0 ? (
          <div className={styles.media}>
            <MediaThumbnailStrip
              assets={entry.media}
              title={`${TIMELINE_TYPE_LABEL[entry.type]}の添付`}
            />
          </div>
        ) : null}
        {renderBody(catId, entry, foodProductImageUrls)}
      </article>
    </div>
  );
}

function renderBody(
  catId: string,
  entry: TimelineEntry,
  foodProductImageUrls: Record<string, string>,
) {
  switch (entry.type) {
    case "feeding": {
      const { record } = entry;
      const totalIntakeG = record.items.reduce(
        (sum, item) => sum + item.estimatedIntakeG,
        0,
      );
      const totalKcal = record.items.reduce(
        (sum, item) => sum + item.estimatedKcal,
        0,
      );
      return (
        <div className={styles.body}>
          <ul className={styles.feedingImages}>
            {record.items.map((item) => (
              <li key={item.id}>
                <FoodProductImage
                  name={item.foodProductName}
                  thumbnailUrl={foodProductImageUrls[item.foodProductId]}
                />
              </li>
            ))}
          </ul>
          <dl className={styles.summary} aria-label="食事の合計（推定）">
            <div>
              <dt>
                <FeedingIcon aria-hidden="true" size={18} />
                食べた量
                <span className={styles.estimate}>（推定）</span>
              </dt>
              <dd>
                {totalIntakeG}
                <span>g</span>
              </dd>
            </div>
            <div>
              <dt>
                <CalorieIcon aria-hidden="true" size={18} />
                カロリー
                <span className={styles.estimate}>（推定）</span>
              </dt>
              <dd>
                {totalKcal.toFixed(1)}
                <span>kcal</span>
              </dd>
            </div>
          </dl>
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
    case "cleaning": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>
            {record.cleaningTargetName}
            {record.memo ? `・${record.memo}` : ""}
          </p>
          <ButtonLink
            href={`/cats/${catId}/cleaning/targets/${record.cleaningTargetId}/records/${record.id}/edit`}
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
