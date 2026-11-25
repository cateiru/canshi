import { describe, expect, it } from "vitest";
import { MEMO_LABELS_MAX, memoRecordFormSchema } from "./schema";

describe("memoRecordFormSchema", () => {
  it("日付を残すときは日付・時刻とともに返す", () => {
    const result = memoRecordFormSchema.safeParse({
      hasDate: "on",
      recordedDate: "2026-10-31",
      recordedTime: "08:00",
      content: " 爪を切った ",
    });
    expect(result.success && result.data).toEqual({
      content: "爪を切った",
      labelIds: [],
      recordedDate: "2026-10-31",
      recordedTime: "08:00",
    });
  });

  it("日付を残さないときは、日付・時刻の欄が無くても成功し、日付を返さない", () => {
    const result = memoRecordFormSchema.safeParse({
      hasDate: null,
      recordedDate: null,
      recordedTime: null,
      content: "好きなおもちゃはねずみ",
    });
    expect(result.success && result.data).toEqual({
      content: "好きなおもちゃはねずみ",
      labelIds: [],
      recordedDate: null,
      recordedTime: null,
    });
  });

  it("ラベルは重複を除いて返し、多すぎると失敗する", () => {
    const parse = (labelIds: unknown) =>
      memoRecordFormSchema.safeParse({
        hasDate: null,
        recordedDate: null,
        recordedTime: null,
        content: "メモ",
        labelIds,
      });
    const ids = Array.from(
      { length: MEMO_LABELS_MAX },
      (_, index) => `label-${index}`,
    );

    expect(parse(["a", "b", "a"]).data?.labelIds).toEqual(["a", "b"]);
    expect(parse([...ids, ids[0]]).data?.labelIds).toEqual(ids);
    expect(parse([...ids, "extra"]).error?.flatten().fieldErrors).toEqual({
      labelIds: [`ラベルは${MEMO_LABELS_MAX}個まで付けられます`],
    });
    expect(parse("a").success).toBe(false);
    expect(parse([""]).success).toBe(false);
  });

  it("日付を残すときは、日付・時刻の形式が不正だと失敗する", () => {
    const result = memoRecordFormSchema.safeParse({
      hasDate: "on",
      recordedDate: "2026/10/31",
      recordedTime: "25:00",
      content: "メモ",
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors).toEqual({
      recordedDate: ["日付の形式が正しくありません"],
      recordedTime: ["時刻の形式が正しくありません"],
    });
  });

  it("本文が空・空白だけ・長すぎると失敗する", () => {
    for (const content of [null, "", "   ", "あ".repeat(2001)]) {
      const result = memoRecordFormSchema.safeParse({ hasDate: null, content });
      expect(result.success).toBe(false);
    }
  });
});
