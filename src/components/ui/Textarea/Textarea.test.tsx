import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("errorMessage を textarea に関連付ける", () => {
    render(<Textarea label="メモ" errorMessage="必須です" />);

    const textarea = screen.getByLabelText("メモ");
    const error = screen.getByText("必須です");

    expect(textarea).toHaveAttribute("aria-describedby", error.id);
    expect(textarea).toHaveAttribute("aria-invalid", "true");
  });
});
