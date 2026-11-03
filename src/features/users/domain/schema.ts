import { z } from "zod";

export const userProfileFormSchema = z.object({
  name: z
    .string({ error: "名前を入力してください" })
    .trim()
    .min(1, "名前を入力してください")
    .max(50, "名前は50文字以内で入力してください"),
});

export type UserProfileFormInput = z.infer<typeof userProfileFormSchema>;

export type UserProfileFormFieldErrors = Partial<
  Record<keyof UserProfileFormInput, string[]>
>;
