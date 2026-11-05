import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Cat } from "@/db/schema";
import { CoatField } from "./CoatField";

function renderInForm(cat?: Partial<Cat>) {
  const { container } = render(
    <form>
      <CoatField cat={cat as Cat | undefined} />
    </form>,
  );
  const form = container.querySelector("form") as HTMLFormElement;
  return () => Object.fromEntries(new FormData(form));
}

describe("CoatField", () => {
  it("登録時はすべて未設定として送信する", () => {
    const read = renderInForm();
    expect(read()).toEqual({ coatColor: "", coatPattern: "", coatWhite: "" });
    expect(screen.getByText("未設定", { selector: "p" })).toBeInTheDocument();
  });

  it("編集時は今の毛色・柄を選び、選び直すと見本の名前も変わる", () => {
    const read = renderInForm({
      coatColor: "red",
      coatPattern: "mackerel_tabby",
      coatWhite: null,
    });
    expect(read()).toEqual({
      coatColor: "red",
      coatPattern: "mackerel_tabby",
      coatWhite: "",
    });
    expect(screen.getByText("茶（レッド）・縞（トラ）")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("radio", { name: "少し（胸・足先など）" }),
    );

    expect(read()).toMatchObject({ coatWhite: "low" });
    expect(
      screen.getByText("茶（レッド）・縞（トラ）・白少し"),
    ).toBeInTheDocument();
  });
});
