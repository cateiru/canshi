import { describe, expect, it } from "vitest";
import { cleaningTargetFormSchema } from "./targetSchema";

describe("cleaningTargetFormSchema", () => {
  it("名前と頻度があれば成功する", () => {
    const result = cleaningTargetFormSchema.safeParse({
      name: "猫砂",
      frequencyDays: "7",
      isActive: "on",
    });
    expect(result.success).toBe(true);
  });

  it("名前が空だと失敗する", () => {
    const result = cleaningTargetFormSchema.safeParse({
      name: "",
      frequencyDays: "7",
      isActive: "on",
    });
    expect(result.success).toBe(false);
  });

  it("頻度が0以下だと失敗する", () => {
    const result = cleaningTargetFormSchema.safeParse({
      name: "猫砂",
      frequencyDays: "0",
      isActive: "on",
    });
    expect(result.success).toBe(false);
  });

  it("isActive のチェックを外すと false になる", () => {
    const result = cleaningTargetFormSchema.safeParse({
      name: "猫砂",
      frequencyDays: "7",
      isActive: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
    }
  });
});
