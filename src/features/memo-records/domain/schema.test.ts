import { describe, expect, it } from "vitest";
import { MEMO_LABEL_NAME_MAX_LENGTH } from "./labelSchema";
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
      labels: [],
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
      labels: [],
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

  it("画面で付けたラベルは、名前の前後の空白を除いて返し、空・長すぎる・多すぎると失敗する", () => {
    const parse = (labels: unknown) =>
      memoRecordFormSchema.safeParse({
        hasDate: null,
        recordedDate: null,
        recordedTime: null,
        content: "メモ",
        labels,
      });
    const errorOf = (labels: unknown) =>
      parse(labels).error?.flatten().fieldErrors;

    expect(
      parse([
        { id: "label-1", name: "病院" },
        { id: null, name: " お手入れ " },
      ]).data?.labels,
    ).toEqual([
      { id: "label-1", name: "病院" },
      { id: null, name: "お手入れ" },
    ]);
    expect(errorOf([{ id: null, name: " " }])).toEqual({
      labels: ["ラベルの名前を入力してください"],
    });
    expect(
      errorOf([
        { id: null, name: "あ".repeat(MEMO_LABEL_NAME_MAX_LENGTH + 1) },
      ]),
    ).toEqual({
      labels: [
        `ラベルの名前は${MEMO_LABEL_NAME_MAX_LENGTH}文字以内で入力してください`,
      ],
    });
    expect(
      errorOf(
        Array.from({ length: MEMO_LABELS_MAX + 1 }, (_, index) => ({
          id: null,
          name: `ラベル${index}`,
        })),
      ),
    ).toEqual({ labels: [`ラベルは${MEMO_LABELS_MAX}個まで付けられます`] });
    // 送られた値を JSON として読めなかったとき
    expect(errorOf([null])).toEqual({
      labels: ["ラベルの指定が正しくありません"],
    });
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
