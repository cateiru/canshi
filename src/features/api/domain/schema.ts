import { z } from "zod";
import { API_TOKEN_EXPIRATIONS } from "./apiToken";

export const API_TOKEN_NAME_MAX_LENGTH = 50;

export const apiTokenFormSchema = z.object({
  name: z
    .string({ error: "トークンの名前を入力してください" })
    .trim()
    .min(1, "トークンの名前を入力してください")
    .max(
      API_TOKEN_NAME_MAX_LENGTH,
      `トークンの名前は${API_TOKEN_NAME_MAX_LENGTH}文字以内で入力してください`,
    ),
  expiration: z.enum(API_TOKEN_EXPIRATIONS, {
    error: "有効期限を選択してください",
  }),
});

export type ApiTokenFormInput = z.infer<typeof apiTokenFormSchema>;

export type ApiTokenFormFieldErrors = Partial<
  Record<keyof ApiTokenFormInput, string[]>
>;
