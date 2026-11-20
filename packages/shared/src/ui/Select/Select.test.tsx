import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select } from "./Select";

const OPTIONS = [
  { value: "female", label: "メス" },
  { value: "male", label: "オス" },
];

describe("Select", () => {
  it("label とプレースホルダーを表示する", () => {
    render(
      <Select label="性別" options={OPTIONS} placeholder="選択してください" />,
    );

    expect(screen.getByRole("button", { name: /性別/ })).toBeInTheDocument();
  });
});
