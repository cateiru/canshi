import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { addToast, ToastRegionRoot, toastQueue } from "./Toast";

describe("Toast", () => {
  afterEach(() => {
    act(() => {
      toastQueue.clear();
    });
  });

  it("addToast で追加した内容を表示する", () => {
    render(<ToastRegionRoot />);

    act(() => {
      addToast({ title: "保存しました" });
    });

    expect(screen.getByText("保存しました")).toBeInTheDocument();
  });

  it("閉じるボタンでトーストが消える", () => {
    render(<ToastRegionRoot />);

    act(() => {
      addToast({ title: "保存しました" });
    });

    act(() => {
      screen.getByRole("button", { name: "閉じる" }).click();
    });

    expect(screen.queryByText("保存しました")).not.toBeInTheDocument();
  });
});
