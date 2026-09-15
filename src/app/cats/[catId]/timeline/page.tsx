import Link from "next/link";
import { notFound } from "next/navigation";
import { TbTimeline } from "react-icons/tb";
import { Breadcrumb } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { listFoodProductImageUrls } from "@/features/food-products/queries";
import { getNaiveUtcNow, splitDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import { formatYm, parseYm, shiftYm } from "@/features/shared/yearMonth";
import { buildTimelineHref } from "@/features/timeline/href";
import {
  listTimelineForMonth,
  MAX_PAGE,
  normalizePositiveInt,
} from "@/features/timeline/queries";
import { TimelineCalendar } from "@/features/timeline/TimelineCalendar";
import { TimelineEntryCard } from "@/features/timeline/TimelineEntryCard";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// listTimelineForMonth 内部でも同じ上限でクランプされるが、リンク生成側の
// page パラメータが極端な値（Infinity・巨大な数値など）にならないよう
// あらかじめ丸めておく
function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return normalizePositiveInt(parsed, MAX_PAGE);
}

// date は「表示中の月（ym）に属する日付」のときだけ有効にする。書式違反や
// 月をまたいだ古い date パラメータ（例えば前月選択中に月送りリンクを踏んだ場合）は
// 無視し、月全体の表示にフォールバックする
function parseSelectedDate(
  value: string | undefined,
  ym: string,
): string | null {
  if (value == null || !DATE_PATTERN.test(value)) {
    return null;
  }
  return value.slice(0, 7) === ym ? value : null;
}

type TimelinePageProps = {
  params: Promise<{ catId: string }>;
  searchParams: Promise<{
    page?: string;
    ym?: string;
    date?: string;
  }>;
};

export default async function TimelinePage({
  params,
  searchParams,
}: TimelinePageProps) {
  const { catId } = await params;
  const { page: pageParam, ym: ymParam, date: dateParam } = await searchParams;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const page = parsePage(pageParam);

  // サーバーの実UTC時刻ではなく、記録の保存値と同じ「naive UTC」の現在時刻を
  // 基準にする（datetime.ts の getNaiveUtcNow を参照）。実UTCのまま使うと
  // JST 0時〜9時台にカレンダーの既定表示月・今日のハイライトが1日ずれる
  const nowDateKey = splitDateTimeUtc(getNaiveUtcNow()).date;
  const currentMonth = {
    year: Number.parseInt(nowDateKey.slice(0, 4), 10),
    month: Number.parseInt(nowDateKey.slice(5, 7), 10),
  };
  const { year, month } = parseYm(ymParam, currentMonth);
  const ym = formatYm({ year, month });
  // ym・date のどちらのクエリも付いていない、リンクを一切経由しない素の初期表示
  // （メニューからの遷移・ブックマーク等）でだけ、今日をクリックした状態にする。
  // カレンダー内のリンクは月送り・日付選択のどちらも必ず ym を付与するため、
  // これらを踏んだ結果 date が外れたケース（同じ日を再クリックして絞り込みを
  // 解除した場合など）とは ymParam の有無で区別できる
  const selectedDate =
    ymParam == null && dateParam == null
      ? nowDateKey
      : parseSelectedDate(dateParam, ym);

  const { entries, hasMore, datesByDay } = await listTimelineForMonth(
    catId,
    year,
    month,
    {
      page,
      pageSize: PAGE_SIZE,
      date: selectedDate ?? undefined,
    },
  );

  const prevHref = buildTimelineHref(catId, {
    page: page - 1,
    ym,
    date: selectedDate ?? undefined,
  });
  const nextHref = buildTimelineHref(catId, {
    page: page + 1,
    ym,
    date: selectedDate ?? undefined,
  });
  const prevMonth = shiftYm({ year, month }, -1);
  const nextMonth = shiftYm({ year, month }, 1);
  // 月を移動すると選択中の日付は別の月に属することになるため、date は
  // 引き継がず月全体の表示に戻す。ページも 1 に戻す
  const prevMonthHref = buildTimelineHref(catId, {
    page: 1,
    ym: formatYm(prevMonth),
  });
  const nextMonthHref = buildTimelineHref(catId, {
    page: 1,
    ym: formatYm(nextMonth),
  });

  const foodProductImageUrls = await listFoodProductImageUrls([
    ...new Set(
      entries
        .filter((entry) => entry.type === "feeding")
        .flatMap((entry) =>
          entry.record.items.map((item) => item.foodProductId),
        ),
    ),
  ]);

  const emptyMessage = selectedDate
    ? `${selectedDate.slice(0, 4)}年${Number.parseInt(selectedDate.slice(5, 7), 10)}月${Number.parseInt(selectedDate.slice(8, 10), 10)}日の記録がありません。`
    : `${year}年${month}月の記録がありません。`;

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "タイムライン" },
        ]}
      />

      <RecordPageHeading icon={TbTimeline}>
        {cat.name}のタイムライン
      </RecordPageHeading>

      <Surface title="カレンダー">
        <TimelineCalendar
          catId={catId}
          year={year}
          month={month}
          ym={ym}
          datesByDay={datesByDay}
          todayKey={nowDateKey}
          selectedDate={selectedDate}
          prevHref={prevMonthHref}
          nextHref={nextMonthHref}
        />
      </Surface>

      {selectedDate ? (
        <p className={styles.dateFilterLabel}>
          {selectedDate.slice(0, 4)}年
          {Number.parseInt(selectedDate.slice(5, 7), 10)}月
          {Number.parseInt(selectedDate.slice(8, 10), 10)}日の記録
        </p>
      ) : null}

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

      <div className={styles.pagination}>
        {page > 1 ? <Link href={prevHref}>← 前のページ</Link> : <span />}
        {hasMore ? <Link href={nextHref}>次のページ →</Link> : <span />}
      </div>
    </main>
  );
}
