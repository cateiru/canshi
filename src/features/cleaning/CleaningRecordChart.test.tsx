import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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

const DATA: CleaningRecordCalendarDatum[] = [
  { day: "2025-03-01", value: 1 },
  { day: "2026-01-10", value: 1 },
  { day: "2026-09-15", value: 2 },
];

function openChart() {
  fireEvent.click(screen.getByRole("button", { name: "実施日カレンダー" }));
}

describe("CleaningRecordChart", () => {
  it("初期表示ではグラフが折りたたまれている", () => {
    render(<CleaningRecordChart data={DATA} />);

    const trigger = screen.getByRole("button", { name: "実施日カレンダー" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("開くと最新の年のデータがキャンバスに渡る", async () => {
    render(<CleaningRecordChart data={DATA} />);

    openChart();

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("2");
  });

  it("年を切り替えるとキャンバスに渡るデータが変わる", async () => {
    render(<CleaningRecordChart data={DATA} />);

    openChart();

    const group = screen.getByRole("radiogroup", { name: "表示年" });
    fireEvent.click(within(group).getByRole("radio", { name: "2025年" }));

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("1");
  });

  it("データが空の場合は何も表示しない", () => {
    const { container } = render(<CleaningRecordChart data={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
