import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = ["1m", "3m", "all"] as const;
const LABELS = { "1m": "1ヶ月", "3m": "3ヶ月", all: "すべて" };

describe("SegmentedControl", () => {
  it("選択肢を並べ、value の選択肢を選択中にする", () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        labels={LABELS}
        value="3m"
        onChange={() => {}}
        aria-label="表示期間"
      />,
    );

    expect(
      screen.getByRole("radiogroup", { name: "表示期間" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "3ヶ月" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "1ヶ月" })).not.toBeChecked();
  });

  it("選択肢を押すと onChange に値を渡す", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        options={OPTIONS}
        labels={LABELS}
        value="3m"
        onChange={onChange}
        aria-label="表示期間"
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "すべて" }));
    expect(onChange).toHaveBeenCalledWith("all");
  });
});
