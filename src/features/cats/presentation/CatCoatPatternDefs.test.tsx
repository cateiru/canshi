import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatCoatPatternDefs, catCoatIconStyle } from "./CatCoatPatternDefs";

describe("catCoatIconStyle", () => {
  it("ベース色が未設定なら何も設定しない（既定のクリーム色のまま）", () => {
    expect(catCoatIconStyle(null, "cat-coat-1")).toBeUndefined();
  });

  it("1 色のベース色は、その色で塗る", () => {
    expect(catCoatIconStyle("brown", "cat-coat-1")).toEqual({
      "--illustration-cat-coat": "#9a7650",
    });
  });

  it("2 色が混ざるベース色は、斑のパターンで塗る", () => {
    expect(catCoatIconStyle("blue_cream", "cat-coat-1")).toEqual({
      "--illustration-cat-coat": 'url("#cat-coat-1") #8f98a5',
    });
  });

  it("濃いベース色は明るくして塗り、目・口を明るい色で描く", () => {
    expect(catCoatIconStyle("black", "cat-coat-1")).toEqual({
      "--illustration-cat-coat": "#4a4442",
      "--illustration-cat-feature": "#fff4df",
    });
  });
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
