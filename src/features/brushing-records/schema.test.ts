import { describe, expect, it } from "vitest";
import { brushingRecordFormSchema } from "./schema";

const baseInput = {
  performedDate: "2026-11-01",
  performedTime: "21:00",
};

describe("brushingRecordFormSchema", () => {
  it("必須項目のみで成功し、任意の項目は未入力・チェックなしになる", () => {
    const result = brushingRecordFormSchema.safeParse({
      ...baseInput,
      durationMinutes: "",
      shedAmount: "",
      hasMats: null,
      hasSkinIssue: null,
      memo: "",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      ...baseInput,
      durationMinutes: undefined,
      shedAmount: undefined,
      hasMats: false,
      hasSkinIssue: false,
      memo: undefined,
    });
  });

  it("すべての項目を入力できる", () => {
    const result = brushingRecordFormSchema.safeParse({
      ...baseInput,
      durationMinutes: "10",
      shedAmount: "more",
      hasMats: "on",
      hasSkinIssue: "on",
      memo: "お腹の毛玉をほぐした",
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      durationMinutes: 10,
      shedAmount: "more",
      hasMats: true,
      hasSkinIssue: true,
      memo: "お腹の毛玉をほぐした",
    });
  });

  it("実施日の形式が不正だと失敗する", () => {
    const result = brushingRecordFormSchema.safeParse({
      ...baseInput,
      performedDate: "2026/11/01",
    });
    expect(result.success).toBe(false);
  });

  it.each([
    ["0", "時間は1分以上で入力してください"],
    ["1.5", "時間は整数（分）で入力してください"],
    ["601", "時間は600分以内で入力してください"],
    ["abc", "時間は数値で入力してください"],
  ])("時間が %s だと失敗する", (durationMinutes, message) => {
    const result = brushingRecordFormSchema.safeParse({
      ...baseInput,
      durationMinutes,
    });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.durationMinutes).toEqual([
      message,
    ]);
  });

  it("抜け毛の量が選択肢にない値だと失敗する", () => {
    const result = brushingRecordFormSchema.safeParse({
      ...baseInput,
      shedAmount: "huge",
    });
    expect(result.success).toBe(false);
  });

  it("備考が500文字を超えると失敗する", () => {
    const result = brushingRecordFormSchema.safeParse({
      ...baseInput,
      memo: "あ".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
