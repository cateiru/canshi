import { describe, expect, it } from "vitest";
import { buildPageHref, paginate, parsePageParam } from "./pagination";

describe("parsePageParam", () => {
  it("正の整数はそのまま返す", () => {
    expect(parsePageParam("3")).toBe(3);
  });

  it("未指定・不正値・0以下は 1 にする", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-2")).toBe(1);
  });

  it("配列なら先頭の値を使う", () => {
    expect(parsePageParam(["2", "5"])).toBe(2);
  });

  it("極端に大きな値は上限に丸める", () => {
    expect(parsePageParam("999999999999")).toBe(100_000);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 120 }, (_, index) => index);

  it("指定ページの分だけを切り出す", () => {
    expect(paginate(items, 1)).toEqual({
      items: items.slice(0, 50),
      page: 1,
      totalPages: 3,
    });
    expect(paginate(items, 3)).toEqual({
      items: items.slice(100, 120),
      page: 3,
      totalPages: 3,
    });
  });

  it("総ページ数を超えるページは最終ページに丸める", () => {
    const result = paginate(items, 10);
    expect(result.page).toBe(3);
    expect(result.items).toEqual(items.slice(100, 120));
  });

  it("50件ちょうどなら1ページに収まる", () => {
    expect(paginate(items.slice(0, 50), 1).totalPages).toBe(1);
  });

  it("0件でも総ページ数は 1", () => {
    expect(paginate([], 1)).toEqual({ items: [], page: 1, totalPages: 1 });
  });

  it("ページサイズを指定できる", () => {
    expect(paginate(items, 2, 10).items).toEqual(items.slice(10, 20));
  });
});

describe("buildPageHref", () => {
  it("1ページ目は page パラメータを付けない", () => {
    expect(buildPageHref("/cats/c1/poop-records", 1)).toBe(
      "/cats/c1/poop-records",
    );
  });

  it("2ページ目以降は page パラメータを付ける", () => {
    expect(buildPageHref("/cats/c1/poop-records", 2)).toBe(
      "/cats/c1/poop-records?page=2",
    );
  });
});
