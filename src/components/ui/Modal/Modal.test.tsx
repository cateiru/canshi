import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("ReactNode の title でも dialog にアクセシブル名が付く", () => {
    render(
      <Modal open title={<span>確認ダイアログ</span>} onClose={vi.fn()}>
        内容
      </Modal>,
    );

    expect(
      screen.getByRole("dialog", { name: "確認ダイアログ" }),
    ).toBeInTheDocument();
  });

  it("closeButtonLabel を指定すると、右上の閉じるボタンで onClose を呼ぶ", () => {
    const onClose = vi.fn();
    render(
      <Modal open title="確認" closeButtonLabel="閉じる" onClose={onClose}>
        内容
      </Modal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("閉じられるモーダルは、closeButtonLabel がなくても右上に「閉じる」ボタンを出す", () => {
    const onClose = vi.fn();
    render(
      <Modal open title="確認" onClose={onClose}>
        内容
      </Modal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("閉じられないモーダルは、closeButtonLabel がなければ閉じるボタンを出さない", () => {
    render(
      <Modal open title="確認" isDismissable={false} onClose={vi.fn()}>
        内容
      </Modal>,
    );

    expect(screen.queryByRole("button", { name: "閉じる" })).toBeNull();
  });
});
