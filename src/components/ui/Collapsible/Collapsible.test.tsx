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

  it("storageKey を省略すると、開閉しても LocalStorage に保存しない", () => {
    render(
      <Collapsible title="グラフ" defaultExpanded={false}>
        <p>グラフの内容</p>
      </Collapsible>,
    );

    const trigger = screen.getByRole("button", { name: "グラフ" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(window.localStorage.length).toBe(0);
  });

  it("見出しの階層と、見出し横の補足を指定できる", () => {
    render(
      <Collapsible title="BCSの見方" headingLevel={3} titleAside="5段階">
        <p>内容</p>
      </Collapsible>,
    );

    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("BCSの見方");
    expect(heading).toHaveTextContent("5段階");
  });
});
