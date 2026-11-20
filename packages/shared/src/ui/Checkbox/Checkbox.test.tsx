import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./Checkbox";

describe("Checkbox", () => {
  it("label を表示する", () => {
    render(<Checkbox>ドライフード</Checkbox>);
    expect(
      screen.getByRole("checkbox", { name: "ドライフード" }),
    ).toBeInTheDocument();
  });

  it("クリックで選択状態が切り替わる", () => {
    render(<Checkbox>ドライフード</Checkbox>);

    const checkbox = screen.getByRole("checkbox", { name: "ドライフード" });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
