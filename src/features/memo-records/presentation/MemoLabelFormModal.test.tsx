import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SaveMemoLabelActionResult } from "./labelActions";
import { MemoLabelFormModal } from "./MemoLabelFormModal";

function renderModal(
  result: SaveMemoLabelActionResult,
  label?: { id: string; name: string },
) {
  const action = vi.fn().mockResolvedValue(result);
  const onSaved = vi.fn();
  render(
    <MemoLabelFormModal
      open
      label={label}
      action={action}
      onSaved={onSaved}
      onClose={() => {}}
    />,
  );
  return { action, onSaved };
}

describe("MemoLabelFormModal", () => {
  it("名前を入力して追加すると、追加したラベルを渡す", async () => {
    const saved = { id: "label-1", name: "病院" };
    const { action, onSaved } = renderModal({ label: saved });

    fireEvent.change(screen.getByRole("textbox", { name: "名前" }), {
      target: { value: "病院" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加する" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    expect(action).toHaveBeenCalledWith({ name: "病院" });
  });

  it("編集では、今の名前から始める", () => {
    renderModal({ formError: "" }, { id: "label-1", name: "病院" });

    expect(
      screen.getByRole("dialog", { name: "ラベルの編集" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "名前" })).toHaveValue("病院");
  });

  it("保存できなかったときは理由を表示し、入力を残す", async () => {
    const { onSaved } = renderModal({
      fieldErrors: { name: ["同じ名前のラベルがあります"] },
    });

    fireEvent.change(screen.getByRole("textbox", { name: "名前" }), {
      target: { value: "病院" },
    });
    fireEvent.click(screen.getByRole("button", { name: "追加する" }));

    expect(
      await screen.findByText("同じ名前のラベルがあります"),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "名前" })).toHaveValue("病院");
    expect(onSaved).not.toHaveBeenCalled();
  });
});
