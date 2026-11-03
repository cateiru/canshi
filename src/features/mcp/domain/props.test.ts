import { describe, expect, it } from "vitest";
import { getClientIdFromProps, getUserIdFromProps } from "./props";

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

describe("getClientIdFromProps", () => {
  it("トークンに保存したクライアントの ID を返し、無ければ null", () => {
    expect(getClientIdFromProps({ userId: "u1", clientId: "c1" })).toBe("c1");
    expect(getClientIdFromProps({ userId: "u1" })).toBe(null);
    expect(getClientIdFromProps({ clientId: "" })).toBe(null);
    expect(getClientIdFromProps(undefined)).toBe(null);
  });
});
