import { z } from "zod";

export const householdNameFormSchema = z.object({
  name: z
    .string({ error: "家の名前を入力してください" })
    .trim()
    .min(1, "家の名前を入力してください")
    .max(50, "家の名前は50文字以内で入力してください"),
});

export type HouseholdNameFormInput = z.infer<typeof householdNameFormSchema>;

export type HouseholdNameFormFieldErrors = Partial<
  Record<keyof HouseholdNameFormInput, string[]>
>;
