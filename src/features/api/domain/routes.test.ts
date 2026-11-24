import { describe, expect, it } from "vitest";
import { matchApiRoute } from "./routes";

describe("matchApiRoute", () => {
  it("メソッドとパスに合うエンドポイントと、パスの引数を返す", () => {
    expect(
      matchApiRoute("PATCH", "/cats/cat-1/poop-records/record%201"),
    ).toMatchObject({
      route: { operation: "update_poop_record" },
      params: { catId: "cat-1", id: "record 1" },
    });
  });

  it("パスだけが合うときは、使えるメソッドを返す", () => {
    expect(matchApiRoute("DELETE", "/cats/cat-1")).toEqual({
      route: null,
      allow: ["GET", "PATCH"],
    });
  });

  it.each([
    "",
    "/",
    "/unknown",
    "/cats/",
    "/cats/cat-1/timeline/extra",
    // 正しくエンコードされていない値
    "/cats/%E3%81",
  ])("合うパスが無ければ null（%s）", (path) => {
    expect(matchApiRoute("GET", path)).toBeNull();
  });
});
