import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Radio, RadioGroup } from "./Radio";

describe("RadioGroup / Radio", () => {
  it("label とオプションを表示する", () => {
    render(
      <RadioGroup label="性別">
        <Radio value="female">メス</Radio>
        <Radio value="male">オス</Radio>
      </RadioGroup>,
    );

    expect(screen.getByText("性別")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "メス" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "オス" })).toBeInTheDocument();
  });

  it("クリックで選択が切り替わる", () => {
    render(
      <RadioGroup label="性別">
        <Radio value="female">メス</Radio>
        <Radio value="male">オス</Radio>
      </RadioGroup>,
    );

    const male = screen.getByRole("radio", { name: "オス" });
    fireEvent.click(male);
    expect(male).toBeChecked();
  });
});
