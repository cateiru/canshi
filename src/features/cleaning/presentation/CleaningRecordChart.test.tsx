import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  // 開閉状態は localStorage に保存されるため、テストごとに初期状態へ戻す
  window.localStorage.clear();
});

const NOW = "2026-09-16T00:00:00.000Z";

const DATA: CleaningRecordCalendarDatum[] = [
  { day: "2025-03-01", value: 1 }, // 直近1年の範囲外
  { day: "2026-01-10", value: 1 },
  { day: "2026-09-15", value: 2 },
];

describe("CleaningRecordChart", () => {
  it("初期表示ではグラフが折りたたまれている", () => {
    render(<CleaningRecordChart data={DATA} now={NOW} />);

    const trigger = screen.getByRole("button", { name: "実施日カレンダー" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("開くと今日を終端とした直近1年のデータだけがキャンバスに渡る", async () => {
    render(<CleaningRecordChart data={DATA} now={NOW} />);

    fireEvent.click(screen.getByRole("button", { name: "実施日カレンダー" }));

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("2");
  });

  it("データが空の場合は何も表示しない", () => {
    const { container } = render(<CleaningRecordChart data={[]} now={NOW} />);

    expect(container).toBeEmptyDOMElement();
  });
});
