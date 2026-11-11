import { describe, expect, it } from "vitest";
import { type KeyedLineDatum, placeAllData } from "./KeyedLineLayers";

type PlaceAllDataArgs = Parameters<typeof placeAllData>[0];

const DAY_MS = 24 * 60 * 60 * 1000;
const ORIGIN_MS = Date.UTC(2026, 9, 12);
/** 2026-10-12 を 0 として 1 日 10px */
const xScale = ((date: Date) =>
  ((date.getTime() - ORIGIN_MS) / DAY_MS) *
  10) as unknown as PlaceAllDataArgs["xScale"];
/** 値 1 につき 10px、値 10 が上端 */
const yScale = ((value: number) =>
  (10 - value) * 10) as unknown as PlaceAllDataArgs["yScale"];

const LINE_WIDTH = 4;
const POINT_SIZE = 12;
const POINT_BORDER_WIDTH = 3;
const POINT_RADIUS = POINT_SIZE / 2 + POINT_BORDER_WIDTH;

function datum(key: string, iso: string, y: number): KeyedLineDatum {
  return { key, x: new Date(iso), y };
}

/** Nivo がレイヤーに渡す series と同じ形で、期間内の点の位置を作る */
function seriesOf(inPeriod: KeyedLineDatum[]): PlaceAllDataArgs["series"] {
  return [
    {
      id: "series",
      data: inPeriod.map((d) => ({
        data: d,
        position: {
          x: xScale(
            new Date(
              Date.UTC(
                d.x.getUTCFullYear(),
                d.x.getUTCMonth(),
                d.x.getUTCDate(),
              ),
            ),
          ),
          y: yScale(d.y),
        },
      })),
    },
  ] as unknown as PlaceAllDataArgs["series"];
}

function place(allData: KeyedLineDatum[], inPeriod: KeyedLineDatum[]) {
  const placed = placeAllData({
    allData,
    series: seriesOf(inPeriod),
    xScale,
    yScale,
    lineWidth: LINE_WIDTH,
    pointSize: POINT_SIZE,
    pointBorderWidth: POINT_BORDER_WIDTH,
  });
  return new Map(placed.map((p) => [p.key, p]));
}

describe("placeAllData", () => {
  it("期間内の点は Nivo が配置した位置のまま置く", () => {
    const inPeriod = [
      datum("b", "2026-10-12T15:00:00Z", 4),
      datum("c", "2026-10-13T09:00:00Z", 5),
    ];
    const placed = place(
      [datum("a", "2026-10-01T09:00:00Z", 4), ...inPeriod],
      inPeriod,
    );

    expect(placed.get("b")).toEqual({
      key: "b",
      x: 0,
      y: 60,
      isInPeriod: true,
    });
    expect(placed.get("c")).toEqual({
      key: "c",
      x: 10,
      y: 50,
      isInPeriod: true,
    });
  });

  it("十分に離れた期間外の点は、今のスケールの位置に置く", () => {
    const inPeriod = [
      datum("b", "2026-10-12T15:00:00Z", 4),
      datum("c", "2026-10-13T09:00:00Z", 5),
    ];
    const placed = place(
      [datum("a", "2026-10-01T09:00:00Z", 4.5), ...inPeriod],
      inPeriod,
    );

    expect(placed.get("a")).toEqual({
      key: "a",
      x: -110,
      y: 55,
      isInPeriod: false,
    });
  });

  it("境界の日の期間外の記録は、期間内の端の点と同じ x に置かず左へ離す", () => {
    const inPeriod = [
      datum("c", "2026-10-12T15:00:00Z", 4),
      datum("d", "2026-10-13T09:00:00Z", 5),
    ];
    const placed = place(
      [
        datum("a", "2026-10-11T09:00:00Z", 4),
        datum("b", "2026-10-12T09:00:00Z", 6),
        ...inPeriod,
      ],
      inPeriod,
    );

    const b = placed.get("b");
    const a = placed.get("a");
    // 縦の差 20px：線のはみ出し（太さの半分 × 縦の差 ÷ 横の距離）が点の半径に収まる距離
    const minGap = LINE_WIDTH / 2 + ((LINE_WIDTH / 2) * 20) / POINT_RADIUS;
    expect(b?.isInPeriod).toBe(false);
    expect(b?.y).toBe(40);
    expect(b?.x).toBeLessThanOrEqual(0 - minGap);
    // それより前の点は、離した点より左に並ぶ
    expect(a?.x).toBeLessThanOrEqual(b?.x ?? Number.NaN);
  });

  it("前の日の点でも、傾きが急で線がはみ出す距離なら左へ離す", () => {
    const inPeriod = [
      datum("b", "2026-10-12T15:00:00Z", 1),
      datum("c", "2026-10-13T09:00:00Z", 1),
    ];
    const placed = place(
      [datum("a", "2026-10-11T09:00:00Z", 9), ...inPeriod],
      inPeriod,
    );

    // 縦の差 80px・横の距離 10px のままだと、線が点の半径より長く内側へはみ出す
    const minGap = LINE_WIDTH / 2 + ((LINE_WIDTH / 2) * 80) / POINT_RADIUS;
    expect(placed.get("a")?.x).toBeLessThanOrEqual(0 - minGap);
  });

  it("期間より後の点は、期間内の右端の点から右へ離す", () => {
    const inPeriod = [
      datum("a", "2026-10-12T09:00:00Z", 4),
      datum("b", "2026-10-13T09:00:00Z", 5),
    ];
    const placed = place(
      [...inPeriod, datum("c", "2026-10-13T20:00:00Z", 7)],
      inPeriod,
    );

    const minGap = LINE_WIDTH / 2 + ((LINE_WIDTH / 2) * 20) / POINT_RADIUS;
    expect(placed.get("c")?.x).toBeGreaterThanOrEqual(10 + minGap);
  });

  it("期間内が 1 日だけのときは、期間外の点を近いほうの端の点に重ねる", () => {
    const inPeriod = [datum("b", "2026-10-12T15:00:00Z", 4)];
    const placed = place(
      [
        datum("a", "2026-10-01T09:00:00Z", 6),
        ...inPeriod,
        datum("c", "2026-10-20T09:00:00Z", 7),
      ],
      inPeriod,
    );

    expect(placed.get("a")).toEqual({
      key: "a",
      x: 0,
      y: 60,
      isInPeriod: false,
    });
    expect(placed.get("c")).toEqual({
      key: "c",
      x: 0,
      y: 60,
      isInPeriod: false,
    });
  });
});
