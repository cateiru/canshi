import { describe, expect, it } from "vitest";
import { catFormSchema } from "./schema";

describe("catFormSchema", () => {
  it("必須項目のみでも成功する", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "female",
      birthDate: "",
      breed: "",
      adoptedAt: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.birthDate).toBeUndefined();
    }
  });

  it("名前が空の場合は失敗する", () => {
    const result = catFormSchema.safeParse({
      name: "",
      sex: "female",
    });

    expect(result.success).toBe(false);
  });

  it("性別が不正な値の場合は失敗する", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "invalid",
    });

    expect(result.success).toBe(false);
  });

  it("日付の形式が不正な場合は失敗する", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "female",
      birthDate: "2020-13-40",
    });

    expect(result.success).toBe(false);
  });

  it("すべての項目を入力すると成功する", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "female",
      birthDate: "2020-04-01",
      breed: "雑種",
      adoptedAt: "2020-06-01",
    });

    expect(result.success).toBe(true);
  });
});
