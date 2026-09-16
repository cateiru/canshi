import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Collapsible } from "./Collapsible";

describe("Collapsible", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("デフォルトで展開され、内容が表示される", () => {
    render(
      <Collapsible title="基本情報" storageKey="test-key">
        <p>猫の詳細</p>
      </Collapsible>,
    );

    expect(screen.getByRole("button", { name: "基本情報" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText("猫の詳細")).toBeInTheDocument();
  });

  it("クリックすると折りたたまれ、LocalStorage に状態が保存される", () => {
    render(
      <Collapsible title="基本情報" storageKey="test-key">
        <p>猫の詳細</p>
      </Collapsible>,
    );

    const trigger = screen.getByRole("button", { name: "基本情報" });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(window.localStorage.getItem("test-key")).toBe("false");
  });

  it("LocalStorage に保存された折りたたみ状態を初期表示に反映する", () => {
    window.localStorage.setItem("test-key", "false");

    render(
      <Collapsible title="基本情報" storageKey="test-key">
        <p>猫の詳細</p>
      </Collapsible>,
    );

    expect(screen.getByRole("button", { name: "基本情報" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
