import type { PoopRecord } from "@/db/schema";

export type PoopChartPoint = {
  id: string;
  occurredAtIso: string;
  consistency: PoopRecord["consistency"];
  hourValue: number;
};

export type PoopChartPeriod = "1w" | "3m" | "6m";

export const POOP_CHART_PERIOD_LABEL: Record<PoopChartPeriod, string> = {
  "1w": "1週間",
  "3m": "3ヶ月",
  "6m": "半年",
};

const PERIOD_DAYS: Record<PoopChartPeriod, number> = {
  "1w": 7,
  "3m": 90,
  "6m": 180,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * listPoopRecords()（occurredAt 降順）の結果を、グラフ用に
 * 「0時からの経過時間（0〜24の小数）」を取り出した形式へ変換する。
 * occurredAt は datetime.ts の方針どおりユーザー入力の時計の数字をそのまま
 * UTC として保存した値なので、getUTCHours/getUTCMinutes でそのまま
 * 「入力された時刻」を取り出せる。
 */
export function toPoopChartPoints(
  records: Pick<PoopRecord, "id" | "occurredAt" | "consistency">[],
): PoopChartPoint[] {
  return [...records]
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
    .map((record) => ({
      id: record.id,
      occurredAtIso: record.occurredAt.toISOString(),
      consistency: record.consistency,
      hourValue:
        record.occurredAt.getUTCHours() +
        record.occurredAt.getUTCMinutes() / 60,
    }));
}

/** グラフ上の点。dayIndex は何列目（0 始まり、左が古い日）の日に入るか */
export type PoopChartPlacedPoint = PoopChartPoint & { dayIndex: number };

export type PoopChartWindow = {
  /** 各列（1 日）の 0 時を古い順に並べた ISO 文字列。長さが列の数 */
  dayStartIsos: string[];
  /** 列の境界に引く縦線の位置（0〜列の数） */
  gridIndexes: number[];
  /** x 軸の目盛りの位置。列の中心（1週間）または列の左端（3ヶ月・半年） */
  tickIndexes: number[];
  points: PoopChartPlacedPoint[];
};

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * 期間ぶんの日を 1 日 1 列に並べ、その中に入る点を列に割り当てる。
 * 列は「今日」を右端にして、今日を含めて期間の日数だけ遡る（1週間なら 7 列）。
 * now・occurredAt はどちらも時計の数字をそのまま UTC として扱う値なので、
 * 日の境界も UTC の 0 時で区切る。
 *
 * 1 日ごとの縦線は 1週間だけ引く。3ヶ月・半年は列が細くなり、毎日の線では
 * 塗りつぶしと見分けがつかないため、月曜の 0 時（週の区切り）にだけ線を引く。
 */
export function buildPoopChartWindow(
  points: PoopChartPoint[],
  period: PoopChartPeriod,
  now: Date,
): PoopChartWindow {
  const days = PERIOD_DAYS[period];
  const startMs = startOfUtcDay(now) - (days - 1) * DAY_MS;
  const endMs = startMs + days * DAY_MS;

  const dayStarts = Array.from(
    { length: days },
    (_, index) => new Date(startMs + index * DAY_MS),
  );

  const placed: PoopChartPlacedPoint[] = [];
  for (const point of points) {
    const time = new Date(point.occurredAtIso).getTime();
    if (time < startMs || time >= endMs) {
      continue;
    }
    placed.push({ ...point, dayIndex: Math.floor((time - startMs) / DAY_MS) });
  }

  let gridIndexes: number[];
  let tickIndexes: number[];
  if (period === "1w") {
    gridIndexes = Array.from({ length: days + 1 }, (_, index) => index);
    tickIndexes = dayStarts.map((_, index) => index + 0.5);
  } else {
    const mondayIndexes = dayStarts.flatMap((day, index) =>
      day.getUTCDay() === 1 ? [index] : [],
    );
    gridIndexes = [0, ...mondayIndexes.filter((index) => index > 0), days];
    tickIndexes =
      period === "3m"
        ? // 3ヶ月は 2 週ごと（最新の週から数える）
          mondayIndexes.filter(
            (_, index) => (mondayIndexes.length - 1 - index) % 2 === 0,
          )
        : // 半年は各月の 1 日
          dayStarts.flatMap((day, index) =>
            day.getUTCDate() === 1 ? [index] : [],
          );
  }

  return {
    dayStartIsos: dayStarts.map((day) => day.toISOString()),
    gridIndexes,
    tickIndexes,
    points: placed,
  };
}
