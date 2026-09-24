import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BcsField } from "./BcsField";

function getHiddenInput(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('input[name="bcs"]');
}

describe("BcsField", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("初期値がないときは未設定を選択し、空文字を送る", () => {
    const { container } = render(<BcsField />);

    expect(screen.getByRole("radio", { name: "未設定" })).toBeChecked();
    expect(getHiddenInput(container)?.value).toBe("");
  });

  it("BCS を選ぶと値と説明が切り替わり、未設定に戻せる", () => {
    const { container } = render(<BcsField defaultValue={3} />);

    expect(getHiddenInput(container)?.value).toBe("3");
    expect(
      screen.getByText("BCS 3（理想体重）", { selector: "strong" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "BCS 5 肥満" }));
    expect(getHiddenInput(container)?.value).toBe("5");
    expect(
      screen.getByText("BCS 5（肥満）", { selector: "strong" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "未設定" }));
    expect(getHiddenInput(container)?.value).toBe("");
  });

  it("エラーメッセージを表示する", () => {
    render(<BcsField errorMessage="BCSは1〜5から選択してください" />);

    expect(
      screen.getByText("BCSは1〜5から選択してください"),
    ).toBeInTheDocument();
  });
});
