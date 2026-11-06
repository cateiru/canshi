import { describe, expect, it } from "vitest";
import { formatCoat } from "./coat";

describe("formatCoat", () => {
  it("ベース色・柄・白い毛の割合の順に 1 行にまとめる", () => {
    expect(
      formatCoat({
        coatColor: "red",
        coatPattern: "mackerel_tabby",
        coatWhite: "low",
      }),
    ).toBe("茶・縞（トラ）・白少し");
  });

  it("未設定の項目は省く", () => {
    expect(
      formatCoat({ coatColor: null, coatPattern: null, coatWhite: "high" }),
    ).toBe("ほとんど白");
  });

  it("すべて未設定なら null", () => {
    expect(
      formatCoat({ coatColor: null, coatPattern: null, coatWhite: null }),
    ).toBeNull();
  });
});
