import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Coat } from "../domain/coat";
import { CoatField } from "./CoatField";

function renderInForm(initialCoat?: Coat) {
  const { container } = render(
    <form>
      <CoatField initialCoat={initialCoat} />
    </form>,
  );
  const form = container.querySelector("form") as HTMLFormElement;
  return () => Object.fromEntries(new FormData(form));
}

describe("CoatField", () => {
  it("登録時は未設定として送信する", () => {
    const read = renderInForm();
    expect(read()).toEqual({ coatColor: "" });
    expect(screen.getByText("未設定", { selector: "p" })).toBeInTheDocument();
  });

  it("編集時は今の毛色を選び、選び直すとプレビューの名前も変わる", () => {
    const read = renderInForm({ coatColor: "red" });
    expect(read()).toEqual({ coatColor: "red" });
    expect(screen.getByText("茶", { selector: "p" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "黒と茶" }));

    expect(read()).toEqual({ coatColor: "tortoiseshell" });
    expect(screen.getByText("黒と茶", { selector: "p" })).toBeInTheDocument();
  });

  it("プレビューの猫は、祖先で設定された別の毛色を受け継がない", () => {
    const { container } = render(
      <CoatField initialCoat={{ coatColor: null }} />,
    );
    const preview = container.querySelector("svg")?.parentElement;
    expect(preview?.style.getPropertyValue("--illustration-cat-coat")).toBe(
      "initial",
    );
  });
});
