"use client";

import { DotsItem, useAnimatedPath, useMotionConfig } from "@nivo/core";
import type { LineCustomSvgLayer, LineCustomSvgLayerProps } from "@nivo/line";
import { animated } from "@react-spring/web";
import { useId } from "react";

/** 折れ線の 1 点。key は期間を切り替えても同じ記録（日）を指す値にする */
export type KeyedLineDatum = {
  key: string;
  x: Date;
  y: number;
};

export type KeyedLineSeries = {
  id: string;
  data: KeyedLineDatum[];
};

type KeyedLineLayerProps = LineCustomSvgLayerProps<KeyedLineSeries> & {
  /** 期間で絞る前の全件（古い順） */
  allData: readonly KeyedLineDatum[];
};

type PlacedDatum = {
  key: string;
  x: number;
  y: number;
  /** 期間に入る（Nivo に渡した data にある）点か */
  isInPeriod: boolean;
};

/** xScale の precision: "day"・useUTC: true に合わせ、UTC の日の 0 時に切り捨てる */
function floorToUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * 期間外の記録も含めた全件を、今のスケールで配置する。
 *
 * Nivo の線・塗りは前後のパス文字列の数値を出てくる順に補間するため、期間で点の数が
 * 変わると別の記録どうしがつながって動く。全件を描いて期間外を描画領域の外へ置けば、
 * パスの点の数が変わらず、記録ごとに新しい位置へ動く。
 *
 * 期間内が 1 日だけのときは time スケールの範囲が幅 0 になり、全件が中央に寄って
 * 縦の線になってしまう。そのため期間外の点は、時間の近いほうの端にある期間内の点と
 * 同じ位置に重ねる（線の長さが 0 になって見えず、点の数も変わらない）。
 */
function placeAllData({
  allData,
  series,
  xScale,
  yScale,
}: Pick<
  KeyedLineLayerProps,
  "allData" | "series" | "xScale" | "yScale"
>): PlacedDatum[] {
  const inPeriodPositions = new Map(
    (series[0]?.data ?? []).map((datum) => [datum.data.key, datum.position]),
  );
  const isSingleColumn =
    new Set([...inPeriodPositions.values()].map((position) => position.x))
      .size <= 1;
  const firstInPeriodIndex = allData.findIndex((datum) =>
    inPeriodPositions.has(datum.key),
  );
  const firstInPeriod = inPeriodPositions.get(
    allData[firstInPeriodIndex]?.key ?? "",
  );
  const lastInPeriod = inPeriodPositions.get(
    allData.findLast((datum) => inPeriodPositions.has(datum.key))?.key ?? "",
  );

  return allData.map((datum, index): PlacedDatum => {
    const position = inPeriodPositions.get(datum.key);
    if (position) {
      return { key: datum.key, x: position.x, y: position.y, isInPeriod: true };
    }
    const nearestInPeriod =
      index < firstInPeriodIndex ? firstInPeriod : lastInPeriod;
    if (isSingleColumn && nearestInPeriod) {
      return { key: datum.key, ...nearestInPeriod, isInPeriod: false };
    }
    return {
      key: datum.key,
      x: xScale(floorToUtcDay(datum.x)),
      y: yScale(datum.y),
      isInPeriod: false,
    };
  });
}

/** 両端の点が欠けないよう、点の半径と枠線のぶん描画領域より広げる幅 */
function getPointPadding({
  pointSize,
  pointBorderWidth,
}: Pick<KeyedLineLayerProps, "pointSize" | "pointBorderWidth">): number {
  return pointSize / 2 + pointBorderWidth;
}

/**
 * 線・塗りを切り抜く範囲。横は描画領域ちょうどにして、期間外の点へ伸びる線を隠す。
 * 縦は点と同じだけ広げ、上端・下端の線の太さぶんが欠けないようにする
 * （切り替えの途中で、前の縦軸の範囲にあった線が軸の外へはみ出すのも隠れる）
 */
function LineClipPath({
  id,
  innerWidth,
  innerHeight,
  pointSize,
  pointBorderWidth,
}: Pick<
  KeyedLineLayerProps,
  "innerWidth" | "innerHeight" | "pointSize" | "pointBorderWidth"
> & {
  id: string;
}) {
  const padding = getPointPadding({ pointSize, pointBorderWidth });
  return (
    <defs>
      <clipPath id={id}>
        <rect
          x={0}
          y={-padding}
          width={innerWidth}
          height={innerHeight + padding * 2}
        />
      </clipPath>
    </defs>
  );
}

function KeyedAreaLayer(props: KeyedLineLayerProps) {
  const { series, areaGenerator, areaOpacity, enableArea } = props;
  const clipId = useId();
  const placed = placeAllData(props);
  const animatedPath = useAnimatedPath(areaGenerator(placed) ?? "");

  if (!enableArea) {
    return null;
  }

  return (
    <g>
      <LineClipPath id={clipId} {...props} />
      <animated.path
        d={animatedPath}
        fill={series[0]?.color}
        fillOpacity={areaOpacity}
        strokeWidth={0}
        clipPath={`url(#${clipId})`}
      />
    </g>
  );
}

function KeyedLineAndPointsLayer(props: KeyedLineLayerProps) {
  const {
    series,
    points,
    innerWidth,
    innerHeight,
    lineGenerator,
    lineWidth,
    pointSize,
    pointBorderWidth,
  } = props;
  const lineClipId = useId();
  const pointsClipId = useId();
  const { animate } = useMotionConfig();
  const placed = placeAllData(props);
  const animatedPath = useAnimatedPath(lineGenerator(placed) ?? "");

  const seriesColor = series[0]?.color ?? "currentColor";
  const pointColor = points[0]?.color ?? seriesColor;
  const pointBorderColor = points[0]?.borderColor ?? seriesColor;
  const pointPadding = getPointPadding({ pointSize, pointBorderWidth });

  return (
    <g>
      <LineClipPath id={lineClipId} {...props} />
      <defs>
        <clipPath id={pointsClipId}>
          <rect
            x={-pointPadding}
            y={-pointPadding}
            width={innerWidth + pointPadding * 2}
            height={innerHeight + pointPadding * 2}
          />
        </clipPath>
      </defs>
      <animated.path
        d={animatedPath}
        fill="none"
        strokeWidth={lineWidth}
        stroke={seriesColor}
        clipPath={`url(#${lineClipId})`}
      />
      <g clipPath={`url(#${pointsClipId})`}>
        {placed.map((datum) => (
          // 期間外の点は、描画領域のすぐ外にあっても見えないよう透明にする
          <g
            key={datum.key}
            style={{
              opacity: datum.isInPeriod ? 1 : 0,
              transition: animate ? "opacity var(--transition-base)" : "none",
            }}
          >
            <DotsItem
              x={datum.x}
              y={datum.y}
              datum={datum}
              size={pointSize}
              color={pointColor}
              borderWidth={pointBorderWidth}
              borderColor={pointBorderColor}
            />
          </g>
        ))}
      </g>
    </g>
  );
}

/**
 * Nivo の折れ線の areas・lines・points レイヤーの代わりに使うレイヤー。
 * 点を記録の key で描き、期間を切り替えたとき同じ記録の点・線を新しい位置へ動かす。
 * ResponsiveLine の layers で、areas と（lines・points）の位置にそれぞれ置く。
 *
 * xScale は time（precision: "day"・useUTC: true）、系列は 1 つの前提。
 */
export function createKeyedLineLayers(allData: readonly KeyedLineDatum[]): {
  areas: LineCustomSvgLayer<KeyedLineSeries>;
  linesAndPoints: LineCustomSvgLayer<KeyedLineSeries>;
} {
  return {
    areas: (props) => <KeyedAreaLayer {...props} allData={allData} />,
    linesAndPoints: (props) => (
      <KeyedLineAndPointsLayer {...props} allData={allData} />
    ),
  };
}
