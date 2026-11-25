import { act, fireEvent, render, screen } from "@testing-library/react";
import { type FormEventHandler, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TagInput, type TagInputProps } from "./TagInput";

type FormProps = Partial<TagInputProps> & {
  onSubmit: FormEventHandler<HTMLFormElement>;
};

function Form({ onSubmit, onChange, ...props }: FormProps) {
  const [value, setValue] = useState<string[]>([...(props.value ?? [])]);
  return (
    <form data-testid="form" onSubmit={onSubmit}>
      <TagInput
        label="ラベル"
        name="labels"
        {...props}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <button type="submit">保存</button>
    </form>
  );
}

function setup(props: Partial<TagInputProps> = {}) {
  const onChange = vi.fn();
  const onSubmit = vi.fn((event) => event.preventDefault());
  render(<Form {...props} onChange={onChange} onSubmit={onSubmit} />);
  const input = screen.getByRole("combobox", { name: "ラベル" });
  const type = (text: string) => {
    act(() => input.focus());
    fireEvent.change(input, { target: { value: text } });
  };
  const submitted = () =>
    new FormData(screen.getByTestId<HTMLFormElement>("form")).getAll("labels");
  return { input, type, onChange, onSubmit, submitted };
}

const optionNames = () =>
  screen.queryAllByRole("option").map((option) => option.textContent);

describe("TagInput", () => {
  it("入力して Enter を押すとタグにし、フォームは送信しない", () => {
    const { input, type, onChange, onSubmit, submitted } = setup();

    type(" 病院 ");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenLastCalledWith(["病院"]);
    expect(input).toHaveValue("");
    expect(submitted()).toEqual(["病院"]);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "「病院」を追加しました",
    );
  });

  it("変換中の Enter・Backspace ではタグを付け外ししない", () => {
    const { input, type, onChange } = setup({ value: ["お手入れ"] });

    type("びょういん");
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    fireEvent.keyDown(input, { key: "Enter", keyCode: 229 });
    type("");
    fireEvent.keyDown(input, { key: "Backspace", isComposing: true });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("空・空白だけ・付いているタグと同じ文字では、タグを付けない", () => {
    const { input, type, onChange } = setup({ value: ["病院"] });

    for (const text of ["", "  ", "病院"]) {
      type(text);
      fireEvent.keyDown(input, { key: "Enter" });
    }

    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("");
  });

  it("× でタグを外す", () => {
    const { onChange, submitted } = setup({ value: ["お手入れ", "病院"] });

    fireEvent.click(screen.getByRole("button", { name: "「お手入れ」を外す" }));

    expect(onChange).toHaveBeenLastCalledWith(["病院"]);
    expect(submitted()).toEqual(["病院"]);
  });

  it("× をキーボードで押して外すと、次のタグの × にフォーカスを移す", () => {
    setup({ value: ["お手入れ", "病院"] });

    const press = (name: string) =>
      fireEvent.click(screen.getByRole("button", { name }), { detail: 0 });
    press("「お手入れ」を外す");
    expect(
      screen.getByRole("button", { name: "「病院」を外す" }),
    ).toHaveFocus();
    press("「病院」を外す");
    expect(screen.getByRole("combobox", { name: "ラベル" })).toHaveFocus();
  });

  it("入力が空のときだけ、Backspace で最後のタグを外す", () => {
    const { input, type, onChange } = setup({ value: ["お手入れ", "病院"] });

    type("あ");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).not.toHaveBeenCalled();

    type("");
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onChange).toHaveBeenLastCalledWith(["お手入れ"]);
  });

  it("付いていない候補だけを出し、候補を選ぶとタグにする", () => {
    const { input, onChange } = setup({
      value: ["お手入れ"],
      suggestions: ["お手入れ", "病院", "好きなもの"],
    });

    act(() => input.focus());
    expect(optionNames()).toEqual(["病院", "好きなもの"]);
    fireEvent.click(screen.getByRole("option", { name: "好きなもの" }));

    expect(onChange).toHaveBeenLastCalledWith(["お手入れ", "好きなもの"]);
    expect(input).toHaveValue("");
  });

  it("入力した文字を含む候補と、新しいタグとして追加する候補を出す", () => {
    const { type, onChange } = setup({ suggestions: ["病院", "動物病院"] });

    type("病院");
    expect(optionNames()).toEqual(["病院", "動物病院"]);
    type("病");
    expect(optionNames()).toEqual(["病院", "動物病院", "「病」を追加"]);
    fireEvent.click(screen.getByRole("option", { name: "「病」を追加" }));

    expect(onChange).toHaveBeenLastCalledWith(["病"]);
  });

  it("矢印キーで候補を選んでいるときの Enter は、その候補をタグにする", () => {
    const { input, type, onChange } = setup({ suggestions: ["病院"] });

    type("病");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange.mock.calls).toEqual([[["病院"]]]);
  });

  it("確定していない入力途中の文字も、フォームで送る", () => {
    const { type, submitted } = setup({
      value: ["お手入れ"],
      suggestions: ["病院"],
    });

    type(" 性格 ");
    expect(submitted()).toEqual(["お手入れ", "性格"]);
    type("病院");
    expect(submitted()).toEqual(["お手入れ", "病院"]);
    // 付いているタグと同じ文字は 1 つだけ送る
    type("お手入れ");
    expect(submitted()).toEqual(["お手入れ"]);
  });

  it("説明とエラーを入力欄に関連付ける", () => {
    const { input } = setup({
      description: "複数付けられます",
      errorMessage: "多すぎます",
    });

    expect(input).toHaveAccessibleDescription("複数付けられます 多すぎます");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
