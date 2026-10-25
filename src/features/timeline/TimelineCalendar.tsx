import Link from "next/link";
import { MonthNav } from "@/components/ui";
import { shiftYm } from "@/features/shared/yearMonth";
import { CalendarSwipeArea } from "./CalendarSwipeArea";
import { CALENDAR_TRANSITION_TYPE } from "./calendarTransition";
import { buildTimelineHref } from "./href";
import { TIMELINE_TYPE_ICON, TIMELINE_TYPE_LABEL } from "./labels";
import { TIMELINE_RECORD_TYPES, type TimelineRecordType } from "./queries";
import styles from "./TimelineCalendar.module.css";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const MAX_VISIBLE_ICONS = 4;
/** 「前の月」「次の月」で移動したときも、ドラッグしたときと同じ向きにカレンダーをスライドさせる */
const MONTH_NAV_TRANSITION_TYPES = {
  prev: [CALENDAR_TRANSITION_TYPE.prev],
  next: [CALENDAR_TRANSITION_TYPE.next],
};

type CalendarCell = {
  day: number;
  dateKey: string;
  types: TimelineRecordType[];
};

type TimelineCalendarProps = {
  catId: string;
  year: number;
  month: number; // 1-12
  ym: string;
  datesByDay: Map<string, TimelineRecordType[]>;
  /** 今日にあたる日付キー（YYYY-MM-DD）。表示中の月に含まれない場合はどのセルにも一致しない */
  todayKey: string;
  /** 選択中の日付キー（YYYY-MM-DD）。未選択なら null */
  selectedDate: string | null;
  prevHref: string;
  nextHref: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildWeeks(
  year: number,
  month: number,
  datesByDay: Map<string, TimelineRecordType[]>,
): (CalendarCell | null)[][] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (CalendarCell | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${pad2(month)}-${pad2(day)}`;
    cells.push({ day, dateKey, types: datesByDay.get(dateKey) ?? [] });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (CalendarCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function TimelineCalendar({
  catId,
  year,
  month,
  ym,
  datesByDay,
  todayKey,
  selectedDate,
  prevHref,
  nextHref,
}: TimelineCalendarProps) {
  const prevMonth = shiftYm({ year, month }, -1);
  const nextMonth = shiftYm({ year, month }, 1);

  return (
    <div className={styles.calendar}>
      <MonthNav
        year={year}
        month={month}
        prevHref={prevHref}
        nextHref={nextHref}
        transitionTypes={MONTH_NAV_TRANSITION_TYPES}
      />

      <CalendarSwipeArea
        className={styles.scrollArea}
        aria-label="日付を選択"
        prevHref={prevHref}
        nextHref={nextHref}
        // スワイプしているあいだに見せる前後の月。移動した先のページと同じ見た目になるよう、
        // 日付は選択していない状態で描く
        prevPanel={
          <CalendarGrid
            catId={catId}
            {...prevMonth}
            datesByDay={datesByDay}
            todayKey={todayKey}
            selectedDate={null}
          />
        }
        nextPanel={
          <CalendarGrid
            catId={catId}
            {...nextMonth}
            datesByDay={datesByDay}
            todayKey={todayKey}
            selectedDate={null}
          />
        }
      >
        <CalendarGrid
          catId={catId}
          year={year}
          month={month}
          ym={ym}
          datesByDay={datesByDay}
          todayKey={todayKey}
          selectedDate={selectedDate}
        />
      </CalendarSwipeArea>

      <ul className={styles.legend}>
        {TIMELINE_RECORD_TYPES.map((type) => {
          const Icon = TIMELINE_TYPE_ICON[type];
          return (
            <li key={type} className={styles.legendItem}>
              <Icon
                monochrome
                aria-hidden="true"
                className={styles.icon}
                data-record-type={type}
              />
              {TIMELINE_TYPE_LABEL[type]}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type CalendarGridProps = {
  catId: string;
  year: number;
  month: number;
  /** 指定すると日付を選べるリンクにする。省略すると、スワイプ中に見せるだけの前後の月として描く */
  ym?: string;
  datesByDay: Map<string, TimelineRecordType[]>;
  todayKey: string;
  selectedDate: string | null;
};

function CalendarGrid({
  catId,
  year,
  month,
  ym,
  datesByDay,
  todayKey,
  selectedDate,
}: CalendarGridProps) {
  const weeks = buildWeeks(year, month, datesByDay);

  return (
    <table className={styles.grid}>
      <caption className={styles.srOnly}>
        {year}年{month}月のタイムラインカレンダー
      </caption>
      <thead>
        <tr>
          {WEEKDAY_LABELS.map((label) => (
            <th key={label} scope="col" className={styles.weekday}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week.find((cell) => cell != null)?.dateKey ?? "blank"}>
            {week.map((cell, cellIndex) =>
              cell ? (
                <DayCell
                  key={cell.dateKey}
                  catId={catId}
                  ym={ym}
                  cell={cell}
                  isToday={cell.dateKey === todayKey}
                  isSelected={cell.dateKey === selectedDate}
                />
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: 月末・月初の空白セルは値を持たず順序も変わらない
                <td key={cellIndex} className={styles.dayBlank} />
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DayCell({
  catId,
  ym,
  cell,
  isToday,
  isSelected,
}: {
  catId: string;
  ym?: string;
  cell: CalendarCell;
  isToday: boolean;
  isSelected: boolean;
}) {
  const visibleTypes = cell.types.slice(0, MAX_VISIBLE_ICONS);
  const hiddenCount = cell.types.length - visibleTypes.length;
  const label = isSelected
    ? `${cell.day}日の絞り込みを解除`
    : cell.types.length > 0
      ? `${cell.day}日: ${cell.types.map((type) => TIMELINE_TYPE_LABEL[type]).join("・")}`
      : `${cell.day}日`;
  const content = (
    <>
      <span className={styles.dayNumber}>{cell.day}</span>
      {cell.types.length > 0 ? (
        <span className={styles.icons} aria-hidden="true">
          {visibleTypes.map((type) => {
            const Icon = TIMELINE_TYPE_ICON[type];
            return (
              <Icon
                key={type}
                monochrome
                className={styles.icon}
                data-record-type={type}
              />
            );
          })}
          {hiddenCount > 0 ? (
            <span className={styles.moreCount}>+{hiddenCount}</span>
          ) : null}
        </span>
      ) : null}
    </>
  );

  return (
    <td
      className={styles.day}
      data-today={isToday ? "true" : undefined}
      data-selected={isSelected ? "true" : undefined}
    >
      {ym == null ? (
        // 前後の月は見せるだけなので、リンクにせずプリフェッチやフォーカスの対象から外す
        <span className={styles.dayLink}>{content}</span>
      ) : (
        <Link
          // 同じ日をもう一度クリックすると絞り込みが解除されるトグル動作にするため、
          // 選択中の日と同じ場合は date を付けずに月全体のリンクを作る
          href={buildTimelineHref(catId, {
            page: 1,
            ym,
            date: isSelected ? undefined : cell.dateKey,
          })}
          aria-label={label}
          className={styles.dayLink}
        >
          {content}
        </Link>
      )}
    </td>
  );
}
