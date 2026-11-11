import { describe, expect, it } from "vitest";
import { catFormSchema, newCatFormSchema, resolveBirthDate } from "./schema";

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

  it("送信されなかった項目は未入力として扱い、わかる範囲は年月日にする", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "female",
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

  it("避妊・去勢の状況と毛色はプリセットの値だけを受け付け、空なら未設定にする", () => {
    const base = { name: "たま", sex: "female" };
    const filled = catFormSchema.safeParse({
      ...base,
      neuterStatus: "neutered",
      coatColor: "tortoiseshell",
    });
    expect(filled.success && filled.data).toMatchObject({
      neuterStatus: "neutered",
      coatColor: "tortoiseshell",
    });

    const empty = catFormSchema.safeParse({
      ...base,
      neuterStatus: "",
      coatColor: "",
    });
    expect(empty.success && empty.data).toMatchObject({
      neuterStatus: undefined,
      coatColor: undefined,
    });

    for (const invalid of [{ neuterStatus: "yes" }, { coatColor: "rainbow" }]) {
      expect(catFormSchema.safeParse({ ...base, ...invalid }).success).toBe(
        false,
      );
    }
  });

  it("生まれた年が西暦4桁でない場合は失敗する", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "female",
      birthDatePrecision: "year",
      birthYear: "20",
    });

    expect(result.success).toBe(false);
  });

  it("生まれた月が1〜12でない場合は失敗する", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "female",
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

describe("newCatFormSchema", () => {
  it("猫を飼う家を受け付ける", () => {
    const result = newCatFormSchema.safeParse({
      name: "たま",
      sex: "female",
      householdId: "home",
    });

    expect(result.success && result.data.householdId).toBe("home");
  });

  it("家が選択されていない場合は失敗する", () => {
    for (const householdId of [null, ""]) {
      const result = newCatFormSchema.safeParse({
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
});

describe("catFormSchema（更新）", () => {
  it("猫を飼う家は受け取らない", () => {
    const result = catFormSchema.safeParse({
      name: "たま",
      sex: "female",
      householdId: "other",
    });

    expect(result.success).toBe(true);
    expect(result.success && "householdId" in result.data).toBe(false);
  });
});
