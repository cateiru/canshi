import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  mergeFormValues,
  nowDateTimeValues,
  parseFormValues,
  toFormValue,
} from "./formValues";

describe("toFormValue", () => {
  it("真偽値はチェックボックスの値に、null は未入力にする", () => {
    expect(toFormValue(true)).toBe("on");
    expect(toFormValue(false)).toBeNull();
    expect(toFormValue(null)).toBe("");
    expect(toFormValue(3)).toBe(3);
    expect(toFormValue(["a"])).toEqual(["a"]);
  });
});

describe("mergeFormValues", () => {
  it("指定した項目だけを上書きし、省略した項目は元の値のまま", () => {
    expect(
      mergeFormValues(
        { memo: "朝", amount: "多め", hasBlood: "on" },
        { memo: null, amount: undefined, hasBlood: false },
      ),
    ).toEqual({ memo: "", amount: "多め", hasBlood: null });
  });
});

describe("nowDateTimeValues", () => {
  it("日本時間の今の日付・時刻にする", () => {
    expect(
      nowDateTimeValues(
        "occurredDate",
        "occurredTime",
        new Date("2026-10-19T15:30:00.000Z"),
      ),
    ).toEqual({ occurredDate: "2026-10-20", occurredTime: "00:30" });
  });
});

describe("parseFormValues", () => {
  it("検証に失敗したら、項目名とメッセージをまとめて返す", () => {
    const schema = z.object({
      name: z.string().min(1, "名前を入力してください"),
    });

    expect(parseFormValues(schema, { name: "" })).toEqual({
      error: "入力が正しくありません。name: 名前を入力してください",
    });
    expect(parseFormValues(schema, { name: "たま" })).toEqual({
      data: { name: "たま" },
    });
  });
});
