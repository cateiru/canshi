import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { Layout } from "./Layout";
import { STYLES, THEME } from "./styles";

// メインアプリと同じデザイントークン（`@canshi/shared` の tokens.css）
const TOKENS_CSS = readFileSync(
  createRequire(import.meta.url).resolve("@canshi/shared/styles/tokens.css"),
  "utf8",
);

describe("STYLES", () => {
  it("メインアプリと同じ tokens.css をそのまま埋め込む", () => {
    expect(TOKENS_CSS).toContain("--color-bg:");
    expect(STYLES).toContain(TOKENS_CSS);
  });

  it("<style> の中身を途中で閉じない", () => {
    expect(STYLES.toLowerCase()).not.toContain("</style");
  });

  it("管理画面の CSS ではダークテーマを定義しない", () => {
    const adminStyles = STYLES.replace(TOKENS_CSS, "");
    expect(adminStyles).not.toContain("prefers-color-scheme");
    expect(adminStyles).not.toContain("dark");
  });
});

describe("Layout", () => {
  it("<html> の data-theme でライトテーマに固定する", () => {
    expect(THEME).toBe("light");
    const html = String(
      Layout({ title: "概要", currentPath: "/", children: "" }),
    );
    expect(html).toContain('<html lang="ja" data-theme="light">');
    expect(html).toContain('<meta name="color-scheme" content="light"/>');
  });

  it("tokens.css のダークテーマは data-theme が light のときに当たらない", () => {
    // 端末がダークのときのブロックは、data-theme が light・dark のどちらでもないときだけに当たる
    expect(TOKENS_CSS).toContain(
      ':root:not([data-theme="light"]):not([data-theme="dark"])',
    );
    expect(TOKENS_CSS).toContain(':root[data-theme="dark"]');
  });
});
