import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PoopChartPoint } from "./chart";
import { PoopRecordChart } from "./PoopRecordChart";

vi.mock("./PoopRecordChartCanvas", () => ({
  default: ({ points }: { points: PoopChartPoint[] }) => (
    <div data-testid="chart-canvas">{points.length}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

const NOW = "2026-09-30T00:00:00.000Z";

function point(id: string, occurredAtIso: string): PoopChartPoint {
  return { id, occurredAtIso, consistency: "normal", hourValue: 8 };
}

const POINTS: PoopChartPoint[] = [
  point("a", "2025-01-01T00:00:00.000Z"),
  point("b", "2026-08-05T00:00:00.000Z"),
  point("c", "2026-09-15T00:00:00.000Z"),
];

function openChart() {
  fireEvent.click(screen.getByRole("button", { name: "うんちの時間帯" }));
}

describe("PoopRecordChart", () => {
  it("初期表示ではグラフが折りたたまれている", () => {
    render(<PoopRecordChart points={POINTS} now={NOW} />);

    const trigger = screen.getByRole("button", { name: "うんちの時間帯" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("開くと初期表示（直近3ヶ月）で期間内の件数がキャンバスに渡る", async () => {
    render(<PoopRecordChart points={POINTS} now={NOW} />);

    openChart();

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("2");
  });

  it("期間を切り替えるとキャンバスに渡る件数が変わる", async () => {
    render(<PoopRecordChart points={POINTS} now={NOW} />);

    openChart();

    const group = screen.getByRole("radiogroup", { name: "表示期間" });
    fireEvent.click(within(group).getByRole("radio", { name: "全期間" }));

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("3");
  });

  it("選択期間に記録がない場合はメッセージを表示しキャンバスを描画しない", async () => {
    const oldPoints: PoopChartPoint[] = [
      point("a", "2026-01-01T00:00:00.000Z"),
    ];
    render(<PoopRecordChart points={oldPoints} now={NOW} />);

    openChart();

    const group = screen.getByRole("radiogroup", { name: "表示期間" });
    fireEvent.click(within(group).getByRole("radio", { name: "直近1ヶ月" }));

    expect(
      await screen.findByText("この期間の記録はありません。"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("chart-canvas")).not.toBeInTheDocument();
  });
});
