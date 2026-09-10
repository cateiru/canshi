import { describe, expect, it } from "vitest";
import { catPhotoFormSchema } from "./schema";

describe("catPhotoFormSchema", () => {
  it("撮影日時と備考を受け付け、空の備考は undefined にする", () => {
    const result = catPhotoFormSchema.safeParse({
      takenDate: "2026-09-08",
      takenTime: "10:30",
      memo: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memo).toBeUndefined();
    }
  });

  it("日付・時刻の形式が不正なら拒否する", () => {
    const result = catPhotoFormSchema.safeParse({
      takenDate: "2026/09/08",
      takenTime: "25:00",
      memo: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.takenDate?.[0]).toBe("撮影日の形式が正しくありません");
      expect(errors.takenTime?.[0]).toBe("撮影時刻の形式が正しくありません");
    }
  });
});
