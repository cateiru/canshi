import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildMonthlyExpenseChart, type ExpenseChartMonth } from "./chart";
import { ExpenseChart } from "./ExpenseChart";

vi.mock("./ExpenseChartCanvas", () => ({
  default: ({ months }: { months: ExpenseChartMonth[] }) => (
    <div data-testid="chart-canvas">{months.length}</div>
  ),
}));

afterEach(() => {
  cleanup();
});

const MONTHS = buildMonthlyExpenseChart(
  [
    {
      spentAt: new Date("2025-11-10T00:00:00.000Z"),
      category: "food",
      amountYen: 1280,
    },
    {
      spentAt: new Date("2026-09-10T00:00:00.000Z"),
      category: "hospital",
      amountYen: 5500,
    },
  ],
  { year: 2026, month: 9 },
);

function openChart() {
  fireEvent.click(screen.getByRole("button", { name: "月ごとの支出グラフ" }));
}

describe("ExpenseChart", () => {
  it("初期表示ではグラフが折りたたまれている", () => {
    render(<ExpenseChart months={MONTHS} />);

    const trigger = screen.getByRole("button", { name: "月ごとの支出グラフ" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("開くと初期表示（半年）で6か月分がキャンバスに渡る", async () => {
    render(<ExpenseChart months={MONTHS} />);

    openChart();

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("6");
    expect(screen.getByText("2026年4月〜2026年9月")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "カテゴリの凡例" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(7);
  });

  it("期間を切り替えるとキャンバスに渡る月数が変わる", async () => {
    render(<ExpenseChart months={MONTHS} />);

    openChart();
    const group = screen.getByRole("radiogroup", { name: "表示期間" });
    fireEvent.click(within(group).getByRole("radio", { name: "1年" }));

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("12");
    expect(screen.getByText("2025年10月〜2026年9月")).toBeInTheDocument();
  });

  it("「今年」を選ぶと表示中の年の1月からの月がキャンバスに渡る", async () => {
    render(<ExpenseChart months={MONTHS} />);

    openChart();
    const group = screen.getByRole("radiogroup", { name: "表示期間" });
    fireEvent.click(within(group).getByRole("radio", { name: "今年" }));

    expect(await screen.findByTestId("chart-canvas")).toHaveTextContent("9");
    expect(screen.getByText("2026年1月〜2026年9月")).toBeInTheDocument();
  });

  it("表示期間に支出がない場合はメッセージを表示しキャンバスを描画しない", () => {
    render(
      <ExpenseChart
        months={buildMonthlyExpenseChart([], { year: 2026, month: 9 })}
      />,
    );

    openChart();

    expect(
      screen.getByText("この期間の支出はありません。"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("chart-canvas")).not.toBeInTheDocument();
  });
});
