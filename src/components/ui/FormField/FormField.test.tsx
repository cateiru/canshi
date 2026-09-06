import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("errorMessage を input に関連付ける", () => {
    render(<FormField label="名前" errorMessage="必須です" />);

    const input = screen.getByLabelText("名前");
    const error = screen.getByRole("alert");

    expect(error).toHaveTextContent("必須です");
    expect(input).toHaveAttribute("aria-describedby", error.id);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
