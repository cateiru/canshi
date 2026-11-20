import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComboBox } from "./ComboBox";

const OPTIONS = [
  { value: "マンチカン", label: "マンチカン" },
  { value: "ラグドール", label: "ラグドール" },
];

describe("ComboBox", () => {
  it("label を input に関連付け、errorMessage を表示する", () => {
    render(
      <ComboBox label="猫種" options={OPTIONS} errorMessage="長すぎます" />,
    );

    const input = screen.getByRole("combobox", { name: "猫種" });
    const error = screen.getByText("長すぎます");

    expect(input).toHaveAttribute("aria-describedby", error.id);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("入力に一致する候補だけを表示する", () => {
    render(<ComboBox label="猫種" options={OPTIONS} />);

    const input = screen.getByRole("combobox", { name: "猫種" });
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "マンチ" } });

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["マンチカン"]);
  });

  it("allowsCustomValue なら候補にない値もフォームで送信される", () => {
    render(
      <form data-testid="form">
        <ComboBox
          label="猫種"
          name="breed"
          options={OPTIONS}
          allowsCustomValue
        />
      </form>,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "猫種" }), {
      target: { value: "三毛猫" },
    });

    const formData = new FormData(
      screen.getByTestId("form") as HTMLFormElement,
    );
    expect(formData.get("breed")).toBe("三毛猫");
  });
});
