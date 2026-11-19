import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BirthdayCelebrationPreview } from "./BirthdayCelebrationPreview";

describe("BirthdayCelebrationPreview", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("選んだ節目のお祝いを表示し、端末にお祝い済みを記録しない", () => {
    render(<BirthdayCelebrationPreview />);

    fireEvent.click(screen.getByRole("button", { name: "3歳" }));

    expect(
      screen.getByRole("dialog", { name: "お誕生日おめでとう！" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("今日はたまの3歳の誕生日です。"),
    ).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it("閉じたあとも、同じ節目をもう一度開ける", () => {
    render(<BirthdayCelebrationPreview />);

    fireEvent.click(screen.getByRole("button", { name: "生後3ヶ月" }));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "生後3ヶ月" }));
    expect(
      screen.getByRole("dialog", { name: "生後3ヶ月おめでとう！" }),
    ).toBeInTheDocument();
  });

  it("入力した名前でお祝いする", () => {
    render(<BirthdayCelebrationPreview />);

    fireEvent.change(screen.getByRole("textbox", { name: "名前" }), {
      target: { value: "みけ" },
    });
    fireEvent.click(screen.getByRole("button", { name: "12歳" }));

    expect(
      screen.getByText("今日はみけの12歳の誕生日です。"),
    ).toBeInTheDocument();
  });
});
