import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoLabelsField } from "./MemoLabelsField";

const labels = [
  { id: "care", name: "お手入れ", color: "blue" as const },
  { id: "hospital", name: "病院", color: "red" as const },
];

describe("MemoLabelsField", () => {
  it("選んでいるラベルだけをフォームで送り、押すと選択を切り替える", () => {
    const onToggle = vi.fn();
    const { container } = render(
      <form>
        <MemoLabelsField
          labels={labels}
          selectedIds={new Set(["hospital"])}
          onToggle={onToggle}
          onAdd={() => {}}
          isDisabled={false}
        />
      </form>,
    );

    const form = container.querySelector("form") as HTMLFormElement;
    expect(new FormData(form).getAll("labelIds")).toEqual(["hospital"]);
    expect(screen.getByRole("button", { name: "病院" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "お手入れ" }));
    fireEvent.click(screen.getByRole("button", { name: "病院" }));
    expect(onToggle.mock.calls).toEqual([
      ["care", true],
      ["hospital", false],
    ]);
  });

  it("フォームをリセットしても、選んでいるラベルは変わらない", () => {
    const onToggle = vi.fn();
    const { container } = render(
      <form>
        <MemoLabelsField
          labels={labels}
          selectedIds={new Set(["care"])}
          onToggle={onToggle}
          onAdd={() => {}}
          isDisabled={false}
        />
      </form>,
    );

    const form = container.querySelector("form") as HTMLFormElement;
    form.reset();

    expect(new FormData(form).getAll("labelIds")).toEqual(["care"]);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("ラベルがなくても、新しいラベルを作れる", () => {
    const onAdd = vi.fn();
    render(
      <MemoLabelsField
        labels={[]}
        selectedIds={new Set()}
        onToggle={() => {}}
        onAdd={onAdd}
        isDisabled={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "新しいラベル" }));
    expect(onAdd).toHaveBeenCalled();
  });
});
