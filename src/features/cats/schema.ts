import { z } from "zod";

export const BIRTH_DATE_PRECISIONS = ["day", "month", "year"] as const;

export type BirthDatePrecision = (typeof BIRTH_DATE_PRECISIONS)[number];

// 表示中の入力欄だけが送信されるため、送信されなかった項目（`FormData.get` の null）も未入力として扱う
const emptyToUndefined = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;

export const catFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "名前を入力してください")
    .max(50, "名前は50文字以内で入力してください"),
  sex: z.enum(["male", "female", "unknown"], {
    error: "性別を選択してください",
  }),
  // 未送信の場合は、従来どおり年月日すべてを入力する形式として扱う
  birthDatePrecision: z.preprocess(
    emptyToUndefined,
    z
      .enum(BIRTH_DATE_PRECISIONS, {
        error: "生年月日のわかる範囲を選択してください",
      })
      .default("day"),
  ),
  birthDate: z.preprocess(
    emptyToUndefined,
    z.string().date("生年月日の形式が正しくありません").optional(),
  ),
  birthYear: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(/^\d{4}$/, "生まれた年は西暦4桁で入力してください")
      .optional(),
  ),
  birthMonth: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^(?:[1-9]|1[0-2])$/, "生まれた月を選択してください")
      .optional(),
  ),
  breed: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(50, "猫種は50文字以内で入力してください").optional(),
  ),
  adoptedAt: z.preprocess(
    emptyToUndefined,
    z.string().date("お迎え日の形式が正しくありません").optional(),
  ),
});

export type CatFormInput = z.infer<typeof catFormSchema>;

export type CatFormFieldErrors = Partial<Record<keyof CatFormInput, string[]>>;

export type ResolvedBirthDate = {
  birthDate: string | null;
  birthDatePrecision: BirthDatePrecision;
};

/**
 * フォームの入力から、保存する生年月日（`YYYY-MM-DD`）とそのわかっている範囲を求める。
 * 年のみ・年月のみの場合は、未入力の月・日を 1月・1日で補完する。
 * 生まれた年が未入力の場合は生年月日なしとして扱い、年月のみで年だけ入力して月が未選択の
 * 場合はエラーにする
 */
export function resolveBirthDate(
  input: Pick<
    CatFormInput,
    "birthDatePrecision" | "birthDate" | "birthYear" | "birthMonth"
  >,
):
  | { success: true; data: ResolvedBirthDate }
  | { success: false; fieldErrors: CatFormFieldErrors } {
  const { birthDatePrecision } = input;

  if (birthDatePrecision === "day") {
    return {
      success: true,
      data: { birthDate: input.birthDate ?? null, birthDatePrecision },
    };
  }

  if (!input.birthYear) {
    if (birthDatePrecision === "month" && input.birthMonth) {
      return {
        success: false,
        fieldErrors: { birthYear: ["生まれた年を入力してください"] },
      };
    }
    return { success: true, data: { birthDate: null, birthDatePrecision } };
  }

  if (birthDatePrecision === "year") {
    return {
      success: true,
      data: { birthDate: `${input.birthYear}-01-01`, birthDatePrecision },
    };
  }

  if (!input.birthMonth) {
    return {
      success: false,
      fieldErrors: { birthMonth: ["生まれた月を選択してください"] },
    };
  }

  return {
    success: true,
    data: {
      birthDate: `${input.birthYear}-${input.birthMonth.padStart(2, "0")}-01`,
      birthDatePrecision,
    },
  };
}
