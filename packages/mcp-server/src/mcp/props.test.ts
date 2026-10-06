import { describe, expect, it } from "vitest";
import { getUserIdFromProps } from "./props";

describe("getUserIdFromProps", () => {
  it("トークンに保存したユーザー ID を返す", () => {
    expect(
      getUserIdFromProps({ email: "a@example.com", sub: "sub", userId: "u1" }),
    ).toBe("u1");
  });

  it("ユーザーの導入前に発行されたトークン（userId なし）は null", () => {
    expect(getUserIdFromProps({ email: "a@example.com", sub: "sub" })).toBe(
      null,
    );
    expect(
      getUserIdFromProps({ email: "a@example.com", sub: "sub", userId: "" }),
    ).toBe(null);
    expect(getUserIdFromProps(undefined)).toBe(null);
  });
});
