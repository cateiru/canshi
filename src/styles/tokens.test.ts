import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(__dirname, "tokens.css"), "utf8");

function declarationsOf(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} のブロックがない`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start + selector.length + 2, css.indexOf("}", start));
  return body
    .split(";")
    .map((declaration) => declaration.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

describe("ダークテーマのトークン", () => {
  const explicitDark = declarationsOf(':root[data-theme="dark"]');
  const systemDark = declarationsOf(
    ':root:not([data-theme="light"]):not([data-theme="dark"])',
  );

  it("「ダーク」と「システム（端末がダーク）」で同じ値を使う", () => {
    expect(systemDark).toEqual(explicitDark);
  });

  it("ライトテーマで定義した色をすべて上書きする", () => {
    const lightColorNames = declarationsOf(":root")
      .map((declaration) => declaration.split(":")[0])
      .filter(
        (name) =>
          name.startsWith("--color-") &&
          ![
            // ライト・ダークで共通の色
            "--color-accent",
            "--color-accent-cool",
            "--color-success",
            "--color-warning",
            "--color-error",
            "--color-info",
            "--color-illustration-outline",
            // --color-ink / --color-bg と割合から計算されるため、上書き不要
            "--color-border",
            "--color-border-subtle",
            "--color-ink-muted",
            "--color-ink-subtle",
            "--color-border-emphasis",
          ].includes(name),
      );
    const darkNames = explicitDark.map(
      (declaration) => declaration.split(":")[0],
    );

    expect(darkNames).toEqual(expect.arrayContaining(lightColorNames));
  });
});
