import { describe, expect, it } from "vitest";
import { notificationPreferencesFormSchema } from "./settingsSchema";

describe("notificationPreferencesFormSchema", () => {
  it("有効な IANA タイムゾーンは通す", () => {
    const result = notificationPreferencesFormSchema.safeParse({
      notifyTime: "09:00",
      timezone: "Asia/Tokyo",
    });

    expect(result.success).toBe(true);
  });

  it("Intl.DateTimeFormat が構築できない値は拒否する（Select を経由しない POST 対策）", () => {
    const result = notificationPreferencesFormSchema.safeParse({
      notifyTime: "09:00",
      timezone: "Invalid/Zone",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.timezone).toEqual([
        "タイムゾーンの形式が正しくありません",
      ]);
    }
  });

  it("空文字は「タイムゾーンを選択してください」を含めて拒否する", () => {
    const result = notificationPreferencesFormSchema.safeParse({
      notifyTime: "09:00",
      timezone: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.timezone).toContain(
        "タイムゾーンを選択してください",
      );
    }
  });
});
