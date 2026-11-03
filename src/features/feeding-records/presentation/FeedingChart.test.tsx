import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedingChartPoint } from "./chart";
import { FeedingChart } from "./FeedingChart";

vi.mock("./FeedingChartCanvas", () => ({
  default: ({
    points,
    metric,
  }: {
    points: FeedingChartPoint[];
    metric: string;
  }) => <div data-testid={`chart-canvas-${metric}`}>{points.length}</div>,
}));

afterEach(() => {
  cleanup();
});

const NOW = "2026-09-30T00:00:00.000Z";

const POINTS: FeedingChartPoint[] = [
  {
    occurredAtIso: "2025-01-01T00:00:00.000Z",
    totalIntakeG: 20,
    totalKcal: 60,
  },
  {
    occurredAtIso: "2026-08-05T00:00:00.000Z",
    totalIntakeG: 30,
    totalKcal: 90,
  },
  {
    occurredAtIso: "2026-09-15T00:00:00.000Z",
    totalIntakeG: 40,
    totalKcal: 120,
  },
];

function openChart() {
  fireEvent.click(screen.getByRole("button", { name: "ごはんの推移" }));
}

describe("FeedingChart", () => {
  it("初期表示ではグラフが折りたたまれている", () => {
    render(<FeedingChart points={POINTS} now={NOW} />);

    const trigger = screen.getByRole("button", { name: "ごはんの推移" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("開くと初期表示（直近3ヶ月）で期間内の件数が両方のキャンバスに渡る", async () => {
    render(<FeedingChart points={POINTS} now={NOW} />);

    openChart();

    expect(await screen.findByTestId("chart-canvas-intake")).toHaveTextContent(
      "2",
    );
    expect(screen.getByTestId("chart-canvas-kcal")).toHaveTextContent("2");
  });

  it("期間を切り替えると両方のキャンバスに渡る件数が変わる", async () => {
    render(<FeedingChart points={POINTS} now={NOW} />);

    openChart();

    const group = screen.getByRole("radiogroup", { name: "表示期間" });
    fireEvent.click(within(group).getByRole("radio", { name: "全期間" }));

    expect(await screen.findByTestId("chart-canvas-intake")).toHaveTextContent(
      "3",
    );
    expect(screen.getByTestId("chart-canvas-kcal")).toHaveTextContent("3");
  });

  it("選択期間に記録がない場合はメッセージを表示しキャンバスを描画しない", async () => {
    const oldPoints: FeedingChartPoint[] = [
      {
        occurredAtIso: "2026-01-01T00:00:00.000Z",
        totalIntakeG: 20,
        totalKcal: 60,
      },
    ];
    render(<FeedingChart points={oldPoints} now={NOW} />);

    openChart();

    const group = screen.getByRole("radiogroup", { name: "表示期間" });
    fireEvent.click(within(group).getByRole("radio", { name: "直近1ヶ月" }));

    expect(
      await screen.findByText("この期間の記録はありません。"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("chart-canvas-intake")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chart-canvas-kcal")).not.toBeInTheDocument();
  });
});
