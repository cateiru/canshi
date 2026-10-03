import { TbPencil } from "react-icons/tb";
import { Badge, ButtonLink, IconButtonLink } from "@/components/ui";
import {
  CalorieIcon,
  FeedingIcon,
} from "@/components/ui/RecordIcons/RecordIcons";
import { EXPENSE_CATEGORY_LABEL, formatYen } from "@/features/expenses/labels";
import { sumFeedingTotals } from "@/features/feeding-records/calculations";
import {
  FEEDING_MODE_LABEL,
  formatFeedingItemAmounts,
} from "@/features/feeding-records/labels";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
import { MediaThumbnailStrip } from "@/features/media/MediaThumbnailStrip";
import { CONSISTENCY_LABEL } from "@/features/poop-records/labels";
import {
  formatDateTimeUtc,
  splitDateTimeUtc,
} from "@/features/shared/datetime";
import { STATUS_LABEL } from "@/features/symptoms/labels";
import { SUBJECTIVE_AMOUNT_LABEL } from "@/features/water-records/labels";
import {
  formatBcs,
  isBodyConditionScore,
} from "@/features/weight-records/labels";
import { formatAdoptionRecord, formatBirthdayRecord } from "./anniversaries";
import { TIMELINE_TYPE_ICON, TIMELINE_TYPE_LABEL } from "./labels";
import { isTimelineAnniversaryType, type TimelineEntry } from "./queries";
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
  // 記念日は時刻を持たないため、日付だけを表示する
  const occurredAtLabel = isTimelineAnniversaryType(entry.type)
    ? splitDateTimeUtc(entry.occurredAt).date
    : formatDateTimeUtc(entry.occurredAt);
  // 記念日は猫の生年月日・お迎え日から求めるため、編集先は猫のプロフィールになる
  const editLabel = isTimelineAnniversaryType(entry.type)
    ? "猫のプロフィールを編集する"
    : "編集する";

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
        aria-label={`${TIMELINE_TYPE_LABEL[entry.type]} ${occurredAtLabel}`}
      >
        <div className={styles.header}>
          <Badge color="accent">{TIMELINE_TYPE_LABEL[entry.type]}</Badge>
          <div className={styles.headerActions}>
            <time
              className={styles.occurredAt}
              dateTime={entry.occurredAt.toISOString()}
            >
              {occurredAtLabel}
            </time>
            <IconButtonLink
              href={getEditHref(catId, entry)}
              icon={TbPencil}
              aria-label={editLabel}
              title={editLabel}
            />
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
    case "birthday":
    case "adoption":
      return `/cats/${catId}/edit`;
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
    case "birthday":
      return (
        <div className={styles.body}>
          <p>{formatBirthdayRecord(entry.record)}</p>
        </div>
      );
    case "adoption":
      return (
        <div className={styles.body}>
          <p>{formatAdoptionRecord(entry.record)}</p>
        </div>
      );
    case "feeding": {
      const { record } = entry;
      const { totalIntakeG, totalKcal } = sumFeedingTotals(record.items);
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
          {record.mode === "approximate" ? (
            // あいまいモードは摂取量・カロリーを計算しないため、段階の量をそのまま並べる
            <ul
              className={styles.feedingLevels}
              aria-label={FEEDING_MODE_LABEL[record.mode]}
            >
              {record.items.map((item) => {
                const amounts = formatFeedingItemAmounts(record.mode, item);
                return (
                  <li key={item.id}>
                    {`${item.foodProductName}：与えた量 ${amounts.given}・残した量 ${amounts.leftover}`}
                  </li>
                );
              })}
            </ul>
          ) : (
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
          )}
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
