import { afterEach, describe, expect, it } from "vitest";
import { isPageLinkClick } from "./progress";

const CURRENT = "http://localhost:3000/cats/tama?month=2026-10";

/**
 * `target` をクリックし、document の capture の段階で判定した結果を返す。
 * 判定の後は、jsdom が実際に遷移しようとしないようクリックを取り消す
 */
function judgeClick(target: Element, init: MouseEventInit = {}): boolean {
  let result: boolean | undefined;
  const listener = (event: MouseEvent) => {
    result = isPageLinkClick(event, CURRENT);
    event.preventDefault();
  };
  document.addEventListener("click", listener, true);
  target.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...init,
    }),
  );
  document.removeEventListener("click", listener, true);
  if (result === undefined) {
    throw new Error("クリックが document に届かなかった");
  }
  return result;
}

/** `attributes` を持つリンクを置き、その中のアイコンをクリックしたときの判定を返す */
function clickLink(
  attributes: Record<string, string>,
  init: MouseEventInit = {},
): boolean {
  const anchor = document.createElement("a");
  for (const [name, value] of Object.entries(attributes)) {
    anchor.setAttribute(name, value);
  }
  const icon = document.createElement("span");
  anchor.appendChild(icon);
  document.body.appendChild(anchor);
  return judgeClick(icon, init);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("isPageLinkClick", () => {
  it("アプリ内の別のページへのリンクなら出す", () => {
    expect(clickLink({ href: "/settings" })).toBe(true);
  });

  it("同じページで search だけが違うリンク（月の切り替えなど）でも出す", () => {
    expect(clickLink({ href: "/cats/tama?month=2026-09" })).toBe(true);
  });

  it("今と同じページへのリンクでは出さない", () => {
    expect(clickLink({ href: "/cats/tama?month=2026-10" })).toBe(false);
  });

  it("ハッシュだけが違うリンクでは出さない", () => {
    expect(clickLink({ href: "/cats/tama?month=2026-10#records" })).toBe(false);
    expect(clickLink({ href: "#records" })).toBe(false);
  });

  it("別のオリジンへのリンクでは出さない", () => {
    expect(clickLink({ href: "https://example.com/" })).toBe(false);
  });

  it("新しいタブで開くリンク・ダウンロードのリンクでは出さない", () => {
    expect(clickLink({ href: "/settings", target: "_blank" })).toBe(false);
    expect(clickLink({ href: "/settings", download: "" })).toBe(false);
  });

  it("target が _self のリンクでは出す", () => {
    expect(clickLink({ href: "/settings", target: "_self" })).toBe(true);
  });

  it("修飾キーを押しながらのクリック・左ボタン以外のクリックでは出さない", () => {
    for (const init of [
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      expect(clickLink({ href: "/settings" }, init)).toBe(false);
    }
  });

  it("遷移を取りやめたクリックでは出さない", () => {
    // React の capture のハンドラ（document に先に登録される）で取り消した場合にあたる
    const cancel = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("click", cancel, true);
    try {
      expect(clickLink({ href: "/settings" })).toBe(false);
    } finally {
      document.removeEventListener("click", cancel, true);
    }
  });

  it("リンクの外のクリックでは出さない", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);

    expect(judgeClick(button)).toBe(false);
  });
});
