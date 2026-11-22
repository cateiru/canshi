import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpComparisonTable } from "./HelpComparisonTable";

describe("HelpComparisonTable", () => {
  it("項目ごとに、各列でできるかを ○・× と補足で示す", () => {
    render(
      <HelpComparisonTable
        caption="記録方法の比較"
        columns={["厳格モード", "あいまいモード"]}
        rows={[
          {
            label: "カロリーの計算",
            cells: [{ available: true, note: "推定" }, { available: false }],
          },
        ]}
      />,
    );

    const table = screen.getByRole("table", { name: "記録方法の比較" });
    expect(
      within(table).getByRole("columnheader", { name: "厳格モード" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "あいまいモード" }),
    ).toBeInTheDocument();

    const row = within(table).getByRole("row", { name: /カロリーの計算/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells).toHaveLength(2);
    expect(within(cells[0]).getByRole("img", { name: "できる" })).toBeVisible();
    expect(cells[0]).toHaveTextContent("推定");
    expect(
      within(cells[1]).getByRole("img", { name: "できない" }),
    ).toBeVisible();
  });
});
