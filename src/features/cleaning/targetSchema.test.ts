import { describe, expect, it } from "vitest";
import { cleaningTargetFormSchema } from "./targetSchema";

describe("cleaningTargetFormSchema", () => {
  it("名前と頻度があれば成功する", () => {
    const result = cleaningTargetFormSchema.safeParse({
      name: "猫砂",
      frequencyValue: "7",
      frequencyUnit: "days",
      isActive: "on",
    });
    expect(result.success).toBe(true);
  });

  it("頻度の単位に months を指定できる", () => {
    const result = cleaningTargetFormSchema.safeParse({
      name: "フィルター",
      frequencyValue: "2",
      frequencyUnit: "months",
      isActive: "on",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.frequencyUnit).toBe("months");
    }
  });

  it("頻度の単位が不正だと失敗する", () => {
    const result = cleaningTargetFormSchema.safeParse({
      name: "猫砂",
      frequencyValue: "7",
      frequencyUnit: "weeks",
      isActive: "on",
    });
    expect(result.success).toBe(false);
  });

  it("名前が空だと失敗する", () => {
    const result = cleaningTargetFormSchema.safeParse({
      name: "",
      frequencyValue: "7",
      frequencyUnit: "days",
      isActive: "on",
    });
    expect(result.success).toBe(false);
  });

  it("頻度が0以下だと失敗する", () => {
    const result = cleaningTargetFormSchema.safeParse({
      name: "猫砂",
      frequencyValue: "0",
      frequencyUnit: "days",
      isActive: "on",
    });
    expect(result.success).toBe(false);
  });

  it("isActive のチェックを外すと false になる", () => {
    const result = cleaningTargetFormSchema.safeParse({
      name: "猫砂",
      frequencyValue: "7",
      frequencyUnit: "days",
      isActive: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
    }
  });
});
