import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  describe("reserveExpandedSpace", () => {
    function renderReserved() {
      return render(
        <Collapsible
          title="グラフ"
          storageKey="test-key"
          defaultExpanded={false}
          reserveExpandedSpace
        >
          <p>グラフの内容</p>
        </Collapsible>,
      );
    }

    it("保存がなければ defaultExpanded の状態にし、次のフレームで見えるようにする", async () => {
      const { container } = renderReserved();

      expect(screen.getByRole("button", { name: "グラフ" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      const disclosure = container.firstElementChild;
      expect(disclosure).toHaveAttribute("data-restoring", "true");
      // VRT の撮影は aria-busy がなくなるまで待つ
      expect(
        screen.getByText("グラフの内容", { selector: "p" }).parentElement,
      ).toHaveAttribute("aria-busy", "true");
      await waitFor(() => {
        expect(disclosure).not.toHaveAttribute("data-restoring");
      });
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    });

    it("開いたまま保存されていれば、開いた状態で表示する", async () => {
      window.localStorage.setItem("test-key", "true");

      const { container } = renderReserved();

      expect(screen.getByRole("button", { name: "グラフ" })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await waitFor(() => {
        expect(container.firstElementChild).not.toHaveAttribute(
          "data-restoring",
        );
      });
    });

    it("storageKey がなければ空白にせず、すぐに表示する", () => {
      const { container } = render(
        <Collapsible
          title="グラフ"
          defaultExpanded={false}
          reserveExpandedSpace
        >
          <p>グラフの内容</p>
        </Collapsible>,
      );

      expect(container.firstElementChild).not.toHaveAttribute("data-restoring");
      expect(screen.getByRole("button", { name: "グラフ" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });
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

  it("見出しの右端の操作は開閉ボタンの外に描画され、押しても開閉しない", () => {
    render(
      <Collapsible
        title="うちの家"
        titleAside="2匹"
        headerActions={<button type="button">家の設定</button>}
      >
        <p>猫の一覧</p>
      </Collapsible>,
    );

    const trigger = screen.getByRole("button", { name: "うちの家2匹" });
    const action = screen.getByRole("button", { name: "家の設定" });
    expect(trigger).not.toContainElement(action);
    expect(screen.getByRole("heading", { level: 2 })).not.toContainElement(
      action,
    );

    fireEvent.click(action);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
