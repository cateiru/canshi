import { describe, expect, it } from "vitest";
import {
  parseConditionalHeaders,
  parseRangeHeader,
  resolveRange,
} from "./serve";

describe("parseRangeHeader", () => {
  it("start-end / start- / -suffix を R2Range に変換する", () => {
    expect(parseRangeHeader("bytes=0-99")).toEqual({ offset: 0, length: 100 });
    expect(parseRangeHeader("bytes=500-")).toEqual({ offset: 500 });
    expect(parseRangeHeader("bytes=-50")).toEqual({ suffix: 50 });
  });

  it("不正・未対応の指定は null（全体を返す）", () => {
    expect(parseRangeHeader(null)).toBeNull();
    expect(parseRangeHeader("bytes=-")).toBeNull();
    expect(parseRangeHeader("bytes=10-5")).toBeNull();
    expect(parseRangeHeader("bytes=0-1,5-9")).toBeNull();
    expect(parseRangeHeader("items=0-1")).toBeNull();
  });
});

describe("parseConditionalHeaders", () => {
  it("ETag の引用符・弱い比較の接頭辞を取り除き、先頭の 1 件を使う", () => {
    const headers = new Headers({
      "if-none-match": 'W/"abc", "def"',
      "if-match": '"ghi"',
    });
    expect(parseConditionalHeaders(headers)).toEqual({
      etagDoesNotMatch: "abc",
      etagMatches: "ghi",
    });
  });

  it("日付ヘッダを Date に変換し、条件がなければ null", () => {
    const headers = new Headers({
      "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT",
    });
    expect(parseConditionalHeaders(headers)).toEqual({
      uploadedAfter: new Date("2015-10-21T07:28:00.000Z"),
    });
    expect(parseConditionalHeaders(new Headers())).toBeNull();
    expect(
      parseConditionalHeaders(new Headers({ "if-none-match": "*" })),
    ).toBeNull();
  });
});

describe("resolveRange", () => {
  it("要求した Range をサイズに合わせて offset・length に解決する", () => {
    expect(resolveRange({ offset: 0, length: 100 }, 1000)).toEqual({
      offset: 0,
      length: 100,
    });
    expect(resolveRange({ offset: 900 }, 1000)).toEqual({
      offset: 900,
      length: 100,
    });
    expect(resolveRange({ suffix: 50 }, 1000)).toEqual({
      offset: 950,
      length: 50,
    });
    // 末尾を超える要求はサイズで切り詰める
    expect(resolveRange({ offset: 990, length: 100 }, 1000)).toEqual({
      offset: 990,
      length: 10,
    });
    expect(resolveRange({ suffix: 5000 }, 1000)).toEqual({
      offset: 0,
      length: 1000,
    });
  });
});
