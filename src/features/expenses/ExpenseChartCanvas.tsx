"use client";

import { type BarTooltipProps, ResponsiveBar } from "@nivo/bar";
import { useEffect, useState } from "react";
import type { ExpenseCategory } from "@/db/schema";
import { EXPENSE_CATEGORIES } from "@/db/schema";
import { type ExpenseChartMonth, formatChartYearMonth } from "./chart";
import {
  EXPENSE_CATEGORY_COLOR,
  EXPENSE_CATEGORY_LABEL,
  formatYen,
} from "./labels";

type ExpenseChartCanvasProps = {
  months: ExpenseChartMonth[];
};

/** nivo の BarDatum に合わせ、カテゴリごとの金額を 1 階層に展開した行 */
type ExpenseBarDatum = Record<ExpenseCategory, number> & {
  ym: string;
  year: number;
  month: number;
  total: number;
};

const COMPACT_BREAKPOINT_PX = 480;

/** SP幅（page.module.css 等と同じ480pxブレークポイント）かどうかを判定する */
function useIsCompact(): boolean {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT_PX}px)`);
    setIsCompact(query.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompact(event.matches);
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return isCompact;
}

/** Y軸の縦線の一番上に単位ラベルを表示するカスタムレイヤー */
function YAxisUnitLabel() {
  return (
    <text
      x={-36}
      y={-16}
      textAnchor="start"
      style={{
        fill: "var(--color-ink)",
        fontFamily: "var(--font-sans)",
        fontSize: 11,
      }}
    >
      (円)
    </text>
  );
}

const LAYERS = [
  "grid",
  "axes",
  "bars",
  "markers",
  "legends",
  "annotations",
  YAxisUnitLabel,
] as const;

const AXIS_NUMBER_FORMATTER = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 1,
});

/** Y軸の目盛りは桁が増えても幅を取らないよう、1万円以上を「万」で表す */
function formatAxisYen(value: number): string {
  return value >= 10_000
    ? `${AXIS_NUMBER_FORMATTER.format(value / 10_000)}万`
    : AXIS_NUMBER_FORMATTER.format(value);
}

function ExpenseBarTooltip({
  id,
  value,
  color,
  data,
}: BarTooltipProps<ExpenseBarDatum>) {
  return (
    <div
      style={{
        padding: "6px 10px",
        borderRadius: 6,
        background: "var(--color-bg)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontVariantNumeric: "tabular-nums",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.25)",
        whiteSpace: "nowrap",
      }}
    >
      <div style={{ fontWeight: 700 }}>{formatChartYearMonth(data)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: 2,
            background: color,
          }}
        />
        {EXPENSE_CATEGORY_LABEL[id as ExpenseCategory]}: {formatYen(value ?? 0)}
      </div>
      <div>月合計: {formatYen(data.total)}</div>
    </div>
  );
}

const nivoTheme = {
  text: {
    fill: "var(--color-ink)",
    fontFamily: "var(--font-sans)",
    fontSize: 11,
  },
  axis: {
    domain: {
      line: {
        stroke: "color-mix(in srgb, var(--color-ink) 20%, var(--color-bg))",
      },
    },
    ticks: {
      line: {
        stroke: "color-mix(in srgb, var(--color-ink) 20%, var(--color-bg))",
      },
    },
  },
  grid: {
    line: {
      stroke: "color-mix(in srgb, var(--color-ink) 8%, var(--color-bg))",
    },
  },
};

export default function ExpenseChartCanvas({
  months,
}: ExpenseChartCanvasProps) {
  const isCompact = useIsCompact();
  const data: ExpenseBarDatum[] = months.map((month) => ({
    ...month.amounts,
    ym: month.ym,
    year: month.year,
    month: month.month,
    total: month.total,
  }));
  const monthByYm = new Map(months.map((month) => [month.ym, month.month]));
  // SP幅で1年分を並べると「10月11月12月」のようにラベルが詰まるため、
  // 本数が多いときは「月」を省いて数字だけにする
  const monthSuffix = isCompact && months.length > 6 ? "" : "月";

  return (
    <ResponsiveBar<ExpenseBarDatum>
      data={data}
      keys={EXPENSE_CATEGORIES}
      indexBy="ym"
      groupMode="stacked"
      margin={{ top: 26, right: 10, bottom: 32, left: 40 }}
      padding={isCompact ? 0.25 : 0.35}
      valueScale={{ type: "linear", nice: true }}
      colors={({ id }) => EXPENSE_CATEGORY_COLOR[id as ExpenseCategory]}
      // 既定の borderColor / labelTextColor は色を d3-color でパースするため
      // CSS 変数の色では壊れる。枠線とラベルは描かない
      borderWidth={0}
      enableLabel={false}
      axisBottom={{
        tickSize: 0,
        tickPadding: 8,
        format: (ym) => `${monthByYm.get(String(ym)) ?? ""}${monthSuffix}`,
      }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 6,
        tickValues: 4,
        format: (value) => formatAxisYen(Number(value)),
      }}
      gridYValues={4}
      enableGridX={false}
      layers={LAYERS}
      valueFormat={(value) => formatYen(value)}
      tooltip={ExpenseBarTooltip}
      role="img"
      ariaLabel="月ごとのカテゴリ別支出の積み上げ棒グラフ"
      animate={true}
      motionConfig="gentle"
      theme={nivoTheme}
    />
  );
}
