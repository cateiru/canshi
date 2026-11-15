import { describe, expect, it } from "vitest";
import {
  formatMemorialDate,
  getAgeReferenceDate,
  isMemorialCat,
  memorialFormSchema,
} from "./memorial";

describe("isMemorialCat", () => {
  it("メモリーへ移した日があれば true", () => {
    expect(isMemorialCat({ memorialDate: "2026-07-10" })).toBe(true);
    expect(isMemorialCat({ memorialDate: null })).toBe(false);
  });
});

describe("getAgeReferenceDate", () => {
  it("メモリーへ移した猫は、メモリーへ移した日で止める", () => {
    const now = new Date("2026-11-15T03:00:00.000Z");
    expect(getAgeReferenceDate({ memorialDate: "2026-07-10" }, now)).toEqual(
      new Date("2026-07-10T00:00:00.000Z"),
    );
    expect(getAgeReferenceDate({ memorialDate: null }, now)).toBe(now);
  });
});

describe("memorialFormSchema", () => {
  // 2026-11-15 00:30（日本時間）。UTC ではまだ 11-14
  const now = new Date("2026-11-14T15:30:00.000Z");
  const cat = { birthDate: "2015-04-01", adoptedAt: "2015-06-01" };

  it("日本時間の今日までの日付を受け付ける", () => {
    expect(
      memorialFormSchema(cat, now).safeParse({ memorialDate: "2026-11-15" })
        .success,
    ).toBe(true);
  });

  it("今日より後の日付は受け付けない", () => {
    const result = memorialFormSchema(cat, now).safeParse({
      memorialDate: "2026-11-16",
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.memorialDate).toEqual([
      "今日より後の日付は選べません",
    ]);
  });

  it("生年月日・お迎え日より前の日付は受け付けない", () => {
    expect(
      memorialFormSchema(cat, now)
        .safeParse({ memorialDate: "2015-03-31" })
        .error?.flatten().fieldErrors.memorialDate,
    ).toContain("生年月日より前の日付は選べません");
    expect(
      memorialFormSchema(cat, now)
        .safeParse({ memorialDate: "2015-05-31" })
        .error?.flatten().fieldErrors.memorialDate,
    ).toEqual(["お迎え日より前の日付は選べません"]);
  });

  it("未入力・日付でない値は受け付けない", () => {
    expect(
      memorialFormSchema(cat, now)
        .safeParse({ memorialDate: "" })
        .error?.flatten().fieldErrors.memorialDate,
    ).toEqual(["日付を入力してください"]);
    expect(
      memorialFormSchema(cat, now).safeParse({ memorialDate: null }).success,
    ).toBe(false);
    expect(
      memorialFormSchema(cat, now).safeParse({ memorialDate: "2026-13-01" })
        .success,
    ).toBe(false);
  });
});

describe("formatMemorialDate", () => {
  it("年月日で表す", () => {
    expect(formatMemorialDate("2026-07-01")).toBe("2026年7月1日");
  });
});
