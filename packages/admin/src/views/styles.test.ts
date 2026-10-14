import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STYLES, TOKENS } from "./styles";

// メインアプリのデザイントークン（リポジトリルートの `src/styles/tokens.css`）
const TOKENS_CSS = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../src/styles/tokens.css",
  ),
  "utf8",
);

/** tokens.css の最初の `:root { ... }`（ライトテーマの既定値）の宣言 */
function rootDeclarations() {
  const block = TOKENS_CSS.match(/^:root \{([\s\S]*?)^\}/m)?.[1] ?? "";
  const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, "");
  const declarations = new Map<string, string>();
  for (const match of withoutComments.matchAll(/(--[\w-]+):([^;]+);/g)) {
    const value = match[2]
      .replace(/\s+/g, " ")
      .trim()
      // 文字サイズは倍率 1（標準）のときの値にする
      .replace(/^calc\((\d+px) \* var\(--font-scale\)\)$/, "$1")
      .replace(/^max\(16px, calc\(16px \* var\(--font-scale\)\)\)$/, "16px");
    declarations.set(match[1], value);
  }
  return declarations;
}

describe("STYLES", () => {
  it("メインアプリの tokens.css と同じ値のトークンを使う", () => {
    const declarations = rootDeclarations();
    for (const [name, value] of Object.entries(TOKENS)) {
      expect({ name, value: declarations.get(name) }).toEqual({ name, value });
    }
  });

  it("ライトテーマに固定し、ダークテーマに切り替えない", () => {
    expect(STYLES).toContain("color-scheme: light;");
    expect(STYLES).not.toContain("prefers-color-scheme");
    expect(STYLES).not.toContain("dark");
  });
});
