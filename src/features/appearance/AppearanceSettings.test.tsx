import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppearanceSettings } from "./AppearanceSettings";

const { saveThemeAction, saveContrastAction } = vi.hoisted(() => ({
  saveThemeAction: vi.fn().mockResolvedValue(undefined),
  saveContrastAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./actions", () => ({ saveThemeAction, saveContrastAction }));

describe("AppearanceSettings", () => {
  afterEach(() => {
    saveThemeAction.mockClear();
    saveContrastAction.mockClear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.contrast;
  });

  it("現在の設定を選択済みで表示する", () => {
    render(
      <AppearanceSettings
        initialAppearance={{ theme: "system", contrast: "more" }}
      />,
    );

    expect(screen.getByRole("radio", { name: "システム" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "ライト" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "上げる" })).toBeChecked();
    expect(
      screen.getByText(
        "この端末の設定に合わせて、ライトとダークを自動で切り替えます。",
      ),
    ).toBeInTheDocument();
  });

  it("テーマを選ぶと保存し、表示中のページにもすぐ反映する", () => {
    render(
      <AppearanceSettings
        initialAppearance={{ theme: "system", contrast: "default" }}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "ダーク" }));

    expect(screen.getByRole("radio", { name: "ダーク" })).toBeChecked();
    expect(saveThemeAction).toHaveBeenCalledWith("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByText("暗い背景で表示します。")).toBeInTheDocument();
  });

  it("コントラストを選ぶと保存し、表示中のページにもすぐ反映する", () => {
    render(
      <AppearanceSettings
        initialAppearance={{ theme: "light", contrast: "default" }}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "上げる" }));

    expect(saveContrastAction).toHaveBeenCalledWith("more");
    expect(document.documentElement.dataset.contrast).toBe("more");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(saveThemeAction).not.toHaveBeenCalled();
  });
});
