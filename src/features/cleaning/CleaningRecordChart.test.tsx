import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CleaningRecordChart } from "./CleaningRecordChart";
import type { CleaningRecordCalendarDatum } from "./recordChart";

vi.mock("./CleaningRecordChartCanvas", () => ({
  default: ({ data }: { data: CleaningRecordCalendarDatum[] }) => (
    <div data-testid="chart-canvas">{data.length}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

const NOW = "2026-09-16T00:00:00.000Z";

const DATA: CleaningRecordCalendarDatum[] = [
  { day: "2025-03-01", value: 1 }, // 直近1年の範囲外
  { day: "2026-01-10", value: 1 },
  { day: "2026-09-15", value: 2 },
];

describe("CleaningRecordChart", () => {
  it("見出しとグラフを常に表示する", async () => {
    render(<CleaningRecordChart data={DATA} now={NOW} />);

    expect(
      screen.getByRole("heading", { name: "実施日カレンダー" }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("chart-canvas")).toBeInTheDocument();
  });

  it("今日を終端とした直近1年のデータだけがキャンバスに渡る", async () => {
    render(<CleaningRecordChart data={DATA} now={NOW} />);

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("2");
  });

  it("データが空の場合は何も表示しない", () => {
    const { container } = render(<CleaningRecordChart data={[]} now={NOW} />);

    expect(container).toBeEmptyDOMElement();
  });
});
