import { describe, expect, it } from "vitest";
import { memoRecordsHref } from "./paths";

describe("memoRecordsHref", () => {
  it("1 ページ目・絞り込みなしでは、パラメータを付けない", () => {
    expect(memoRecordsHref("cat-1")).toBe("/cats/cat-1/memo-records");
    expect(memoRecordsHref("cat-1", { page: 1 })).toBe(
      "/cats/cat-1/memo-records",
    );
  });

  it("絞り込んだままページを移れる", () => {
    expect(memoRecordsHref("cat-1", { labelId: "a&b", page: 2 })).toBe(
      "/cats/cat-1/memo-records?label=a%26b&page=2",
    );
  });
});
