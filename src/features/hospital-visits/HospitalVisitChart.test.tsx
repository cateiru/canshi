import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HospitalVisitCalendarDatum } from "./chart";
import { HospitalVisitChart } from "./HospitalVisitChart";

vi.mock("./HospitalVisitChartCanvas", () => ({
  default: ({ data }: { data: HospitalVisitCalendarDatum[] }) => (
    <div data-testid="chart-canvas">{data.length}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

const NOW = "2026-09-16T00:00:00.000Z";

const DATA: HospitalVisitCalendarDatum[] = [
  { day: "2025-03-01", value: 1 }, // 直近1年の範囲外
  { day: "2026-01-10", value: 1 },
  { day: "2026-09-15", value: 2 },
];

describe("HospitalVisitChart", () => {
  it("見出しとグラフを常に表示する", async () => {
    render(<HospitalVisitChart data={DATA} now={NOW} />);

    expect(
      screen.getByRole("heading", { name: "通院日カレンダー" }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("chart-canvas")).toBeInTheDocument();
  });

  it("今日を終端とした直近1年のデータだけがキャンバスに渡る", async () => {
    render(<HospitalVisitChart data={DATA} now={NOW} />);

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("2");
  });

  it("データが空の場合は何も表示しない", () => {
    const { container } = render(<HospitalVisitChart data={[]} now={NOW} />);

    expect(container).toBeEmptyDOMElement();
  });
});
