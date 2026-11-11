import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  // 開閉状態は localStorage に保存されるため、テストごとに初期状態へ戻す
  window.localStorage.clear();
});

const NOW = "2026-09-16T00:00:00.000Z";

const DATA: HospitalVisitCalendarDatum[] = [
  { day: "2025-03-01", value: 1 }, // 直近1年の範囲外
  { day: "2026-01-10", value: 1 },
  { day: "2026-09-15", value: 2 },
];

describe("HospitalVisitChart", () => {
  it("初期表示ではグラフが折りたたまれている", () => {
    render(<HospitalVisitChart data={DATA} now={NOW} />);

    const trigger = screen.getByRole("button", { name: "通院日カレンダー" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("開くと今日を終端とした直近1年のデータだけがキャンバスに渡る", async () => {
    render(<HospitalVisitChart data={DATA} now={NOW} />);

    fireEvent.click(screen.getByRole("button", { name: "通院日カレンダー" }));

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("2");
  });

  it("データが空の場合は何も表示しない", () => {
    const { container } = render(<HospitalVisitChart data={[]} now={NOW} />);

    expect(container).toBeEmptyDOMElement();
  });
});
