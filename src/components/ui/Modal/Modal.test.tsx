import { render, screen } from "@testing-library/react";
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
});
