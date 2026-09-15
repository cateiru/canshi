import { z } from "zod";
import { EXPENSE_CATEGORIES } from "@/db/schema";
import { emptyToUndefined } from "@/features/shared/emptyToUndefined";

/** 桁あふれで集計が壊れないようにするための上限（1億円未満） */
export const MAX_AMOUNT_YEN = 99_999_999;

export const amountYenSchema = z
  .union([z.string().trim().min(1, "金額を入力してください"), z.number()], {
    error: "金額を入力してください",
  })
  .pipe(
    z.coerce
      .number<string | number>({ error: "金額は数値で入力してください" })
      .int("金額は整数で入力してください")
      .min(0, "金額は0以上の値を入力してください")
      .max(MAX_AMOUNT_YEN, "金額が大きすぎます"),
  );

export const expenseFormSchema = z.object({
  spentDate: z.string().date("支出日の形式が正しくありません"),
  amountYen: amountYenSchema,
  category: z.enum(EXPENSE_CATEGORIES, {
    error: "カテゴリを選択してください",
  }),
  catIds: z
    .array(z.string().trim().min(1, "関連する猫を選び直してください"))
    .default([])
    .transform((ids) => [...new Set(ids)]),
  memo: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(500, "メモは500文字以内で入力してください")
      .optional(),
  ),
});

export type ExpenseFormInput = z.infer<typeof expenseFormSchema>;

export type ExpenseFormFieldErrors = Partial<
  Record<keyof ExpenseFormInput, string[]>
>;
