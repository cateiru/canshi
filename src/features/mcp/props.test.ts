import { describe, expect, it } from "vitest";
import { getUserIdFromProps } from "./props";

describe("getUserIdFromProps", () => {
  it("トークンに保存したユーザー ID を返す", () => {
    expect(getUserIdFromProps({ userId: "u1" })).toBe("u1");
  });

  it("ユーザー ID を持たないトークンは null", () => {
    expect(getUserIdFromProps({})).toBe(null);
    expect(getUserIdFromProps({ userId: "" })).toBe(null);
    expect(getUserIdFromProps(undefined)).toBe(null);
  });
});
