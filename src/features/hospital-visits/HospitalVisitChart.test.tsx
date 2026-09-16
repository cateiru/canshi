import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
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

const DATA: HospitalVisitCalendarDatum[] = [
  { day: "2025-03-01", value: 1 },
  { day: "2026-01-10", value: 1 },
  { day: "2026-09-15", value: 2 },
];

function openChart() {
  fireEvent.click(screen.getByRole("button", { name: "通院日カレンダー" }));
}

describe("HospitalVisitChart", () => {
  it("初期表示ではグラフが折りたたまれている", () => {
    render(<HospitalVisitChart data={DATA} />);

    const trigger = screen.getByRole("button", { name: "通院日カレンダー" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("開くと最新の年のデータがキャンバスに渡る", async () => {
    render(<HospitalVisitChart data={DATA} />);

    openChart();

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("2");
  });

  it("年を切り替えるとキャンバスに渡るデータが変わる", async () => {
    render(<HospitalVisitChart data={DATA} />);

    openChart();

    const group = screen.getByRole("radiogroup", { name: "表示年" });
    fireEvent.click(within(group).getByRole("radio", { name: "2025年" }));

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("1");
  });

  it("データが空の場合は何も表示しない", () => {
    const { container } = render(<HospitalVisitChart data={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
