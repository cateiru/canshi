import type { TokenExchangeCallbackOptions } from "@cloudflare/workers-oauth-provider";
import { describe, expect, it } from "vitest";
import {
  addClientIdToProps,
  getClientIdFromProps,
  getUserIdFromProps,
} from "./props";

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

describe("addClientIdToProps", () => {
  function options(
    props: Record<string, unknown>,
  ): TokenExchangeCallbackOptions {
    return {
      grantType: "refresh_token",
      clientId: "client-1",
      userId: "u1",
      grantId: "grant-1",
      scope: [],
      requestedScope: [],
      props,
    } as unknown as TokenExchangeCallbackOptions;
  }

  it("クライアントの ID を持たないトークンを更新するときは、受け取るクライアントの ID を追加する", () => {
    expect(addClientIdToProps(options({ userId: "u1" }))).toEqual({
      newProps: { userId: "u1", clientId: "client-1" },
    });
  });

  it("違うクライアントの ID を持っていれば、受け取るクライアントの ID に揃える", () => {
    expect(
      addClientIdToProps(options({ userId: "u1", clientId: "other" })),
    ).toEqual({ newProps: { userId: "u1", clientId: "client-1" } });
  });

  it("揃っていれば何も変えない", () => {
    expect(
      addClientIdToProps(options({ userId: "u1", clientId: "client-1" })),
    ).toBeUndefined();
  });
});
