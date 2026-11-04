import { Pagination } from "@/components/ui";
import { listFoodProductImageUrls } from "@/features/food-products/infrastructure/queries";
import { Surface } from "@/features/shared/Surface";
import type { ListTimelineForMonthResult } from "../infrastructure/queries";
import { buildTimelineHref } from "./href";
import { TimelineEntryCard } from "./TimelineEntryCard";
import styles from "./TimelineEntryList.module.css";

type TimelineEntryListProps = {
  catId: string;
  /** ごはん商品の画像を探す家（猫が家に属していなければ null） */
  householdId: string | null;
  /** 表示中の月（YYYY-MM）。ページ送りのリンクに使う */
  ym: string;
  /** 絞り込み中の日付（YYYY-MM-DD）。ページ送りのリンクに引き継ぐ */
  selectedDate: string | null;
  /** 記録がないときに表示する文言 */
  emptyMessage: string;
  /** ページの描画を待たせないよう、読み込みを始めただけの Promise を受け取る */
  timeline: Promise<ListTimelineForMonthResult>;
};

/**
 * タイムラインの記録の一覧とページ送り。記録の読み込みには時間がかかるため、ページは
 * これを Suspense で包み、読み込んでいるあいだは TimelineEntryListSkeleton を表示する
 */
export async function TimelineEntryList({
  catId,
  householdId,
  ym,
  selectedDate,
  emptyMessage,
  timeline,
}: TimelineEntryListProps) {
  const { entries, page, totalPages } = await timeline;

  const foodProductImageUrls = await listFoodProductImageUrls(
    [
      ...new Set(
        entries
          .filter((entry) => entry.type === "feeding")
          .flatMap((entry) =>
            entry.record.items.map((item) => item.foodProductId),
          ),
      ),
    ],
    { householdId },
  );

  return (
    <>
      {entries.length === 0 ? (
        <Surface>
          <p>{emptyMessage}</p>
        </Surface>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry, index) => (
            <li key={`${entry.type}-${entry.id}`}>
              <TimelineEntryCard
                catId={catId}
                entry={entry}
                isFirst={index === 0}
                isLast={index === entries.length - 1}
                foodProductImageUrls={foodProductImageUrls}
              />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        getHref={(target) =>
          buildTimelineHref(catId, {
            page: target,
            ym,
            date: selectedDate ?? undefined,
          })
        }
      />
    </>
  );
}
