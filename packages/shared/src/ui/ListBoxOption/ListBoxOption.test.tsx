import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select } from "../Select/Select";

const OPTIONS = [
  { value: "female", label: "メス" },
  { value: "male", label: "オス" },
];

describe("ListBoxOption", () => {
  it("選択中の候補だけにチェックを表示する", () => {
    render(<Select label="性別" options={OPTIONS} defaultSelectedKey="male" />);

    fireEvent.click(screen.getByRole("button", { name: /性別/ }));

    const selected = screen.getByRole("option", { name: "オス" });
    const unselected = screen.getByRole("option", { name: "メス" });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected.querySelector("svg")).not.toBeNull();
    expect(unselected.querySelector("svg")).toBeNull();
  });
});
