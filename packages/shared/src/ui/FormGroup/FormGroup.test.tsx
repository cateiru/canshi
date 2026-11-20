import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormGroup } from "./FormGroup";

describe("FormGroup", () => {
  it("見出しをまとまりの名前にし、補足説明を aria-describedby に紐付ける", () => {
    render(
      <FormGroup legend="関連する猫" description="複数選択できます。">
        <input type="checkbox" aria-label="たま" />
      </FormGroup>,
    );

    const group = screen.getByRole("group", { name: "関連する猫" });
    expect(group).toHaveAccessibleDescription("複数選択できます。");
    expect(group).toHaveAttribute("aria-invalid", "false");
  });

  it("エラーを読み上げで通知し、補足説明と合わせて紐付ける", () => {
    render(
      <FormGroup
        legend="関連する猫"
        description="複数選択できます。"
        errorMessage="猫を選んでください"
      >
        <input type="checkbox" aria-label="たま" />
      </FormGroup>,
    );

    const group = screen.getByRole("group", { name: "関連する猫" });
    expect(screen.getByRole("alert")).toHaveTextContent("猫を選んでください");
    expect(group).toHaveAccessibleDescription(
      "複数選択できます。 猫を選んでください",
    );
    expect(group).toHaveAttribute("aria-invalid", "true");
  });

  it("isDisabled で中の入力欄をまとめて無効にする", () => {
    render(
      <FormGroup legend="関連する猫" isDisabled>
        <input type="checkbox" aria-label="たま" />
      </FormGroup>,
    );

    expect(screen.getByRole("checkbox", { name: "たま" })).toBeDisabled();
  });
});
