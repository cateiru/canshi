import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("errorMessage を input に関連付ける", () => {
    render(<FormField label="名前" errorMessage="必須です" />);

    const input = screen.getByLabelText("名前");
    const error = screen.getByText("必須です");

    expect(input).toHaveAttribute("aria-describedby", error.id);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("description を入力欄の説明として紐付ける", () => {
    render(
      <FormField
        label="病院代（円）"
        description="入力すると支出記録として保存されます。"
      />,
    );

    expect(
      screen.getByRole("textbox", { name: "病院代（円）" }),
    ).toHaveAccessibleDescription("入力すると支出記録として保存されます。");
  });
});
