import { TbPencil } from "react-icons/tb";
import { Badge, ButtonLink } from "@/components/ui";
import {
  CalorieIcon,
  FeedingIcon,
} from "@/components/ui/RecordIcons/RecordIcons";
import { EXPENSE_CATEGORY_LABEL, formatYen } from "@/features/expenses/labels";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
import { MediaThumbnailStrip } from "@/features/media/MediaThumbnailStrip";
import { CONSISTENCY_LABEL } from "@/features/poop-records/labels";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { STATUS_LABEL } from "@/features/symptoms/labels";
import { SUBJECTIVE_AMOUNT_LABEL } from "@/features/water-records/labels";
import {
  formatBcs,
  isBodyConditionScore,
} from "@/features/weight-records/labels";
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
          <div className={styles.headerActions}>
            <time
              className={styles.occurredAt}
              dateTime={entry.occurredAt.toISOString()}
            >
              {formatDateTimeUtc(entry.occurredAt)}
            </time>
            <ButtonLink
              href={getEditHref(catId, entry)}
              variant="secondary"
              className={styles.iconButton}
              aria-label="編集する"
              title="編集する"
            >
              <TbPencil aria-hidden="true" size={20} />
            </ButtonLink>
          </div>
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

function getEditHref(catId: string, entry: TimelineEntry): string {
  switch (entry.type) {
    case "feeding":
      return `/cats/${catId}/feeding-records/${entry.record.id}/edit`;
    case "poop":
      return `/cats/${catId}/poop-records/${entry.record.id}/edit`;
    case "weight":
      return `/cats/${catId}/weight-records/${entry.record.id}/edit`;
    case "vomit":
      return `/cats/${catId}/vomit-records/${entry.record.id}/edit`;
    case "water":
      return `/cats/${catId}/water-records/${entry.record.id}/edit`;
    case "shampoo":
      return `/cats/${catId}/shampoo-records/${entry.record.id}/edit`;
    case "cleaning":
      return `/cats/${catId}/cleaning/targets/${entry.record.cleaningTargetId}/records/${entry.record.id}/edit`;
    case "symptom":
      return `/cats/${catId}/symptoms/${entry.record.id}/edit`;
    case "medicationDose":
      return `/cats/${catId}/medications/${entry.record.medicationId}/doses/${entry.record.id}/edit`;
    case "hospitalVisit":
      return `/cats/${catId}/hospital-visits/${entry.record.id}/edit`;
    case "catPhoto":
      return `/cats/${catId}/photos/${entry.record.id}/edit`;
    case "expense":
      return `/cats/${catId}/expenses/${entry.record.id}/edit`;
    default: {
      const exhaustiveCheck: never = entry;
      return exhaustiveCheck;
    }
  }
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
        </div>
      );
    }
    case "weight": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>
            {record.catWeightKg.toFixed(2)} kg
            {isBodyConditionScore(record.bcs)
              ? `・${formatBcs(record.bcs)}`
              : ""}
          </p>
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
        </div>
      );
    }
    case "shampoo": {
      const { record } = entry;
      return record.memo ? (
        <div className={styles.body}>
          <p>{record.memo}</p>
        </div>
      ) : null;
    }
    case "cleaning": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>
            {record.cleaningTargetName}
            {record.memo ? `・${record.memo}` : ""}
          </p>
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
          {record.hospitalVisitId ? (
            <ButtonLink
              href={`/cats/${catId}/hospital-visits/${record.hospitalVisitId}/edit`}
              variant="secondary"
            >
              関連する通院記録
            </ButtonLink>
          ) : null}
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
        </div>
      );
    }
    case "hospitalVisit": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>{record.reason}</p>
          {record.symptomId ? (
            <ButtonLink
              href={`/cats/${catId}/symptoms/${record.symptomId}/edit`}
              variant="secondary"
            >
              関連する症状記録
            </ButtonLink>
          ) : null}
        </div>
      );
    }
    case "catPhoto": {
      const { record } = entry;
      return record.memo ? (
        <div className={styles.body}>
          <p>{record.memo}</p>
        </div>
      ) : null;
    }
    case "expense": {
      const { record } = entry;
      return (
        <div className={styles.body}>
          <p>
            {EXPENSE_CATEGORY_LABEL[record.category]}・
            {formatYen(record.amountYen)}
            {record.memo ? `・${record.memo}` : ""}
          </p>
        </div>
      );
    }
    default: {
      const exhaustiveCheck: never = entry;
      return exhaustiveCheck;
    }
  }
}
