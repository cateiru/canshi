import { describe, expect, it } from "vitest";
import { catFormSchema, resolveBirthDate } from "./schema";

describe("catFormSchema", () => {
  it("必須項目のみでも成功する", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "female",
      householdId: "home",
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
      householdId: "home",
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
      householdId: "home",
      birthDate: "2020-13-40",
    });

    expect(result.success).toBe(false);
  });

  it("すべての項目を入力すると成功する", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "female",
      householdId: "home",
      birthDate: "2020-04-01",
      breed: "雑種",
      adoptedAt: "2020-06-01",
    });

    expect(result.success).toBe(true);
  });

  it("送信されなかった項目は未入力として扱い、わかる範囲は年月日にする", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "female",
      householdId: "home",
      birthDatePrecision: null,
      birthDate: null,
      birthYear: null,
      birthMonth: null,
      breed: null,
      adoptedAt: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.birthDatePrecision).toBe("day");
    }
  });

  it("家が選択されていない場合は失敗する", () => {
    for (const householdId of [null, ""]) {
      const result = catFormSchema.safeParse({
        name: "たま",
        sex: "female",
        householdId,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.householdId).toEqual([
          "家を選択してください",
        ]);
      }
    }
  });

  it("生まれた年が西暦4桁でない場合は失敗する", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "female",
      householdId: "home",
      birthDatePrecision: "year",
      birthYear: "20",
    });

    expect(result.success).toBe(false);
  });

  it("生まれた月が1〜12でない場合は失敗する", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "female",
      householdId: "home",
      birthDatePrecision: "month",
      birthYear: "2020",
      birthMonth: "13",
    });

    expect(result.success).toBe(false);
  });
});

describe("resolveBirthDate", () => {
  it("年月日すべてわかる場合は入力した日付をそのまま使う", () => {
    expect(
      resolveBirthDate({
        birthDatePrecision: "day",
        birthDate: "2020-04-15",
        birthYear: "2019",
        birthMonth: "3",
      }),
    ).toEqual({
      success: true,
      data: { birthDate: "2020-04-15", birthDatePrecision: "day" },
    });
  });

  it("年月のみの場合は日を1日で補完する", () => {
    expect(
      resolveBirthDate({
        birthDatePrecision: "month",
        birthDate: undefined,
        birthYear: "2020",
        birthMonth: "4",
      }),
    ).toEqual({
      success: true,
      data: { birthDate: "2020-04-01", birthDatePrecision: "month" },
    });
  });

  it("年のみの場合は月・日を1月1日で補完する", () => {
    expect(
      resolveBirthDate({
        birthDatePrecision: "year",
        birthDate: undefined,
        birthYear: "2020",
        birthMonth: "4",
      }),
    ).toEqual({
      success: true,
      data: { birthDate: "2020-01-01", birthDatePrecision: "year" },
    });
  });

  it("生まれた年が未入力の場合は生年月日なしとして扱う", () => {
    expect(
      resolveBirthDate({
        birthDatePrecision: "year",
        birthDate: undefined,
        birthYear: undefined,
        birthMonth: undefined,
      }),
    ).toEqual({
      success: true,
      data: { birthDate: null, birthDatePrecision: "year" },
    });
  });

  it("年月のみで月が未選択の場合は失敗する", () => {
    expect(
      resolveBirthDate({
        birthDatePrecision: "month",
        birthDate: undefined,
        birthYear: "2020",
        birthMonth: undefined,
      }),
    ).toEqual({
      success: false,
      fieldErrors: { birthMonth: ["生まれた月を選択してください"] },
    });
  });

  it("年月のみで年が未入力の場合は失敗する", () => {
    expect(
      resolveBirthDate({
        birthDatePrecision: "month",
        birthDate: undefined,
        birthYear: undefined,
        birthMonth: "4",
      }),
    ).toEqual({
      success: false,
      fieldErrors: { birthYear: ["生まれた年を入力してください"] },
    });
  });
});
