import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WeightChartPoint } from "./chart";
import { WeightChart } from "./WeightChart";

vi.mock("./WeightChartCanvas", () => ({
  default: ({ points }: { points: WeightChartPoint[] }) => (
    <div data-testid="chart-canvas">{points.length}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

const NOW = "2026-09-30T00:00:00.000Z";

const POINTS: WeightChartPoint[] = [
  { occurredAtIso: "2025-01-01T00:00:00.000Z", catWeightKg: 3.5 },
  { occurredAtIso: "2026-08-05T00:00:00.000Z", catWeightKg: 4.0 },
  { occurredAtIso: "2026-09-15T00:00:00.000Z", catWeightKg: 4.1 },
];

describe("WeightChart", () => {
  it("初期表示（直近3ヶ月）で期間内の件数がキャンバスに渡る", async () => {
    render(<WeightChart points={POINTS} now={NOW} />);

    const canvas = await screen.findByTestId("chart-canvas");
    expect(canvas).toHaveTextContent("2");
  });

  it("期間を切り替えるとキャンバスに渡る件数が変わる", async () => {
    render(<WeightChart points={POINTS} now={NOW} />);

    const group = screen.getByRole("radiogroup", { name: "表示期間" });
    fireEvent.click(within(group).getByRole("radio", { name: "全期間" }));

    const canvas = await screen.findByTestId("chart-canvas");
    expect(canvas).toHaveTextContent("3");
  });

  it("選択期間に記録がない場合はメッセージを表示しキャンバスを描画しない", async () => {
    const oldPoints: WeightChartPoint[] = [
      { occurredAtIso: "2026-01-01T00:00:00.000Z", catWeightKg: 3.5 },
    ];
    render(<WeightChart points={oldPoints} now={NOW} />);

    const group = screen.getByRole("radiogroup", { name: "表示期間" });
    fireEvent.click(within(group).getByRole("radio", { name: "直近1ヶ月" }));

    expect(
      await screen.findByText("この期間の記録はありません。"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("chart-canvas")).not.toBeInTheDocument();
  });
});
