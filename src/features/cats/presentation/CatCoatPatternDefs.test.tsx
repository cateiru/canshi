import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatCoatPatternDefs, catCoatIconStyle } from "./CatCoatPatternDefs";

describe("catCoatIconStyle", () => {
  it("ベース色が未設定なら何も設定しない（既定のクリーム色のまま）", () => {
    expect(catCoatIconStyle(null, "cat-coat-1")).toBeUndefined();
  });

  it("1 色のベース色は、その色で塗り、ダークテーマの輪郭・目・口の色を渡す", () => {
    expect(catCoatIconStyle("brown", "cat-coat-1")).toEqual({
      "--illustration-cat-coat": "#9a7650",
      "--cat-coat-dark-line": "#4e2f03",
    });
  });

  it("2 色が混ざるベース色は、斑のパターンで塗る", () => {
    expect(catCoatIconStyle("blue_cream", "cat-coat-1")).toEqual({
      "--illustration-cat-coat": 'url("#cat-coat-1") #8f98a5',
      "--cat-coat-dark-line": "#525252",
    });
  });

  it("黒系のベース色は明るくして塗り、ライトテーマの目・口の色を渡し、耳の内側を塗らない", () => {
    expect(catCoatIconStyle("black", "cat-coat-1")).toEqual({
      "--illustration-cat-coat": "#4a4442",
      "--cat-coat-dark-line": "#0e0e0e",
      "--cat-coat-light-feature": "#bbbbbb",
      "--illustration-cat-ear": "none",
    });
  });

  it("isolate では、渡さない値を initial にして祖先の毛色を受け継がない", () => {
    expect(catCoatIconStyle(null, "cat-coat-1", { isolate: true })).toEqual({
      "--illustration-cat-coat": "initial",
      "--illustration-cat-ear": "initial",
      "--cat-coat-light-feature": "initial",
      "--cat-coat-dark-line": "initial",
    });
  });
});

describe("catCoatIconStyle の毛色ごとの線の色", () => {
  it.each([
    ["dark_brown", "#3c2c2c", "#241313"],
    ["tortoiseshell", "#ffffff", "#4e3d3d"],
  ] as const)(
    "%s はライトの目・口を %s、ダークの輪郭・目・口を %s にする",
    (coatColor, lightFeature, darkLine) => {
      expect(catCoatIconStyle(coatColor, "cat-coat-1")).toMatchObject({
        "--cat-coat-light-feature": lightFeature,
        "--cat-coat-dark-line": darkLine,
      });
    },
  );

  it.each([
    ["silver", "#656565"],
    ["red", "#7c4912"],
    ["cream", "#8d5417"],
    ["blue", "#515151"],
    ["white", "#585858"],
  ] as const)(
    "%s はダークの輪郭・目・口を %s にし、ライトの目・口は変えない",
    (coatColor, darkLine) => {
      const style = catCoatIconStyle(coatColor, "cat-coat-1");
      expect(style).toHaveProperty("--cat-coat-dark-line", darkLine);
      expect(style).not.toHaveProperty("--cat-coat-light-feature");
    },
  );
});

describe("CatCoatPatternDefs", () => {
  it("1 色のベース色ではパターンを描かない", () => {
    const { container } = render(
      <CatCoatPatternDefs coatColor="white" patternId="cat-coat-1" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("2 色が混ざるベース色では、渡した id のパターンを描く", () => {
    const { container } = render(
      <CatCoatPatternDefs coatColor="tortoiseshell" patternId="cat-coat-1" />,
    );
    expect(container.querySelector("pattern#cat-coat-1")).not.toBeNull();
  });
});
