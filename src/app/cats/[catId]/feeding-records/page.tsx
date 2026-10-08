import { notFound } from "next/navigation";
import { TbCalendarEvent, TbClock, TbPencil, TbPlus } from "react-icons/tb";
import {
  Badge,
  Breadcrumb,
  ButtonLink,
  IconButtonLink,
  RecordCard,
  RecordEmptyState,
} from "@/components/ui";
import {
  CalorieIcon,
  FeedingIcon,
} from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/session";
import { deleteFeedingRecordAction } from "@/features/feeding-records/actions";
import { sumFeedingTotals } from "@/features/feeding-records/calculations";
import { toFeedingChartPoints } from "@/features/feeding-records/chart";
import { FeedingChart } from "@/features/feeding-records/FeedingChart";
import { groupRecordsByDate } from "@/features/feeding-records/groupByDate";
import {
  FEEDING_MODE_LABEL,
  formatFeedingItemAmounts,
} from "@/features/feeding-records/labels";
import { listFeedingRecords } from "@/features/feeding-records/queries";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
import { listFoodProductImageUrls } from "@/features/food-products/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import {
  formatDateHeadingUtc,
  formatDateTimeUtc,
  getNaiveUtcNow,
  getRelativeDayLabelUtc,
  splitDateTimeUtc,
} from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type FeedingRecordsPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function FeedingRecordsPage({
  params,
}: FeedingRecordsPageProps) {
  const { catId } = await params;
  const cat = await getAccessibleCat(catId);

  if (!cat) {
    notFound();
  }

  const records = await listFeedingRecords(catId);
  const dateGroups = groupRecordsByDate(records);
  // あいまいモードの記録はグラフに含めないため、点が無ければグラフ自体を出さない
  const chartPoints = toFeedingChartPoints(records);
  const now = getNaiveUtcNow();
  const foodProductImageUrls = await listFoodProductImageUrls(
    [
      ...new Set(
        records.flatMap((record) =>
          record.items.map((item) => item.foodProductId),
        ),
      ),
    ],
    { householdId: cat.householdId },
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "ごはん記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={FeedingIcon}>
          {cat.name}のごはん記録
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/feeding-records/new`}
          variant="primary"
          className={styles.createButton}
          leftIcon={TbPlus}
        >
          記録する
        </ButtonLink>
      </div>

      {chartPoints.length > 0 && (
        <FeedingChart points={chartPoints} now={now.toISOString()} />
      )}

      {records.length === 0 ? (
        <RecordEmptyState
          icon={FeedingIcon}
          actions={
            <ButtonLink
              href={`/cats/${catId}/feeding-records/new`}
              variant="primary"
              className={styles.createButton}
            >
              最初の記録をする
            </ButtonLink>
          }
        >
          まだごはん記録がありません。
        </RecordEmptyState>
      ) : (
        <ul className={styles.list}>
          {dateGroups.map((group) => (
            <li key={group.dateKey} className={styles.dateGroup}>
              <div className={styles.dateHeader}>
                <span className={styles.dateIcon}>
                  <TbCalendarEvent aria-hidden="true" size={22} />
                </span>
                <h2 className={styles.dateHeading}>
                  <time dateTime={group.dateKey}>
                    {formatDateHeadingUtc(group.records[0].occurredAt)}
                  </time>
                  {getRelativeDayLabelUtc(group.dateKey, now) && (
                    <span className={styles.relativeDate}>
                      {getRelativeDayLabelUtc(group.dateKey, now)}
                    </span>
                  )}
                </h2>
                <Badge color="accent" className={styles.recordCount}>
                  {group.records.length}件の記録
                </Badge>
              </div>
              <ul className={styles.dateRecords}>
                {group.records.map((record) => {
                  const { totalIntakeG, totalKcal } = sumFeedingTotals(
                    record.items,
                  );

                  return (
                    <li key={record.id}>
                      <RecordCard
                        aria-label={formatDateTimeUtc(record.occurredAt)}
                      >
                        <div className={styles.recordHeader}>
                          <h3 className={styles.recordDate}>
                            <TbClock aria-hidden="true" size={18} />
                            <time dateTime={record.occurredAt.toISOString()}>
                              {splitDateTimeUtc(record.occurredAt).time}
                            </time>
                            {record.mode === "approximate" ? (
                              <Badge color="info">
                                {FEEDING_MODE_LABEL[record.mode]}
                              </Badge>
                            ) : null}
                          </h3>
                          <div className={styles.cardActions}>
                            <IconButtonLink
                              href={`/cats/${catId}/feeding-records/${record.id}/edit`}
                              icon={TbPencil}
                              aria-label="編集する"
                              title="編集する"
                            />
                            <DeleteRecordButton
                              action={deleteFeedingRecordAction.bind(
                                null,
                                catId,
                                record.id,
                              )}
                              title="ごはん記録の削除"
                              description="このごはん記録を削除しますか？この操作は取り消せません。"
                              iconOnly
                            />
                          </div>
                        </div>
                        <ul className={styles.itemsList}>
                          {record.items.map((item) => {
                            const amounts = formatFeedingItemAmounts(
                              record.mode,
                              item,
                            );
                            return (
                              <li key={item.id} className={styles.product}>
                                <span className={styles.productImage}>
                                  <FoodProductImage
                                    name={item.foodProductName}
                                    thumbnailUrl={
                                      foodProductImageUrls[item.foodProductId]
                                    }
                                  />
                                </span>
                                <div className={styles.productInfo}>
                                  <h4 className={styles.productName}>
                                    {item.foodProductName}
                                  </h4>
                                  <dl className={styles.amounts}>
                                    <div>
                                      <dt>与えた量</dt>
                                      <dd>{amounts.given}</dd>
                                    </div>
                                    <div>
                                      <dt>残した量</dt>
                                      <dd>{amounts.leftover}</dd>
                                    </div>
                                  </dl>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                        {record.mode === "strict" ? (
                          <dl
                            className={styles.summary}
                            aria-label="食事の合計（推定）"
                          >
                            <div>
                              <dt>
                                <FeedingIcon aria-hidden="true" size={18} />
                                食べた量
                                <span className={styles.estimate}>
                                  （推定）
                                </span>
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
                                <span className={styles.estimate}>
                                  （推定）
                                </span>
                              </dt>
                              <dd>
                                {totalKcal.toFixed(1)}
                                <span>kcal</span>
                              </dd>
                            </div>
                          </dl>
                        ) : null}
                      </RecordCard>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
