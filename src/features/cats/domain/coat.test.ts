import { describe, expect, it } from "vitest";
import { formatCoat } from "./coat";

describe("formatCoat", () => {
  it("ベース色の名前を返す", () => {
    expect(formatCoat({ coatColor: "tortoiseshell" })).toBe("黒と茶");
  });

  it("未設定なら null", () => {
    expect(formatCoat({ coatColor: null })).toBeNull();
  });
});
