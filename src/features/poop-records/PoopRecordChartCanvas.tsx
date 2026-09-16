"use client";

import { ResponsiveSwarmPlot } from "@nivo/swarmplot";
import { useEffect, useState } from "react";
import type { PoopRecord } from "@/db/schema";
import type { PoopChartPoint } from "./chart";
import { CONSISTENCY_COLOR } from "./labels";

type PoopRecordChartCanvasProps = {
  points: PoopChartPoint[];
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatHourValue(value: number | Date): string {
  const hours =
    typeof value === "number"
      ? value
      : value.getUTCHours() + value.getUTCMinutes() / 60;
  const totalMinutes = Math.round(hours * 60);
  return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`;
}

const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

// すべての点を1つの群として扱い、時刻の分布だけをまとめて表示する
// （便の状態で列を分けると、群ごとの横幅が狭くなり分布が読み取りにくくなる）
const SWARM_GROUP = "all";

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
    legend: {
      text: {
        fill: "var(--color-ink)",
      },
    },
  },
  grid: {
    line: {
      stroke: "color-mix(in srgb, var(--color-ink) 8%, var(--color-bg))",
    },
  },
  tooltip: {
    container: {
      background: "var(--color-bg)",
      color: "var(--color-ink)",
      fontFamily: "var(--font-sans)",
      fontSize: 12,
    },
  },
};

type SwarmDatum = {
  id: string;
  group: string;
  value: number;
  consistency: PoopRecord["consistency"];
};

export default function PoopRecordChartCanvas({
  points,
}: PoopRecordChartCanvasProps) {
  const isCompact = useIsCompact();

  const data: SwarmDatum[] = points.map((point) => ({
    id: point.id,
    group: SWARM_GROUP,
    value: point.hourValue,
    consistency: point.consistency,
  }));

  return (
    <ResponsiveSwarmPlot
      data={data}
      groups={[SWARM_GROUP]}
      id="id"
      value="value"
      groupBy="group"
      layout="vertical"
      valueScale={{ type: "linear", min: 0, max: 24, reverse: true }}
      valueFormat={formatHourValue}
      margin={{ top: 10, right: 16, bottom: 10, left: 46 }}
      size={isCompact ? 9 : 13}
      spacing={isCompact ? 2 : 3}
      gap={isCompact ? 4 : 8}
      colors={(node) => CONSISTENCY_COLOR[node.data.consistency]}
      borderWidth={2}
      borderColor="var(--color-bg)"
      axisTop={null}
      axisRight={null}
      axisLeft={{
        tickValues: HOUR_TICKS,
        format: (value) => `${pad2(Number(value))}:00`,
      }}
      axisBottom={null}
      enableGridX={false}
      gridYValues={HOUR_TICKS}
      isInteractive={true}
      useMesh={true}
      animate={true}
      motionConfig="gentle"
      theme={nivoTheme}
    />
  );
}
