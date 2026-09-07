import { z } from "zod";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";
import { emptyToUndefined } from "@/features/shared/emptyToUndefined";

const optionalPositiveNumber = (message: string) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce.number({ error: message }).positive(message).optional(),
  );

export const weightRecordFormSchema = z
  .object({
    occurredDate: z.string().date("発生日の形式が正しくありません"),
    occurredTime: z
      .string()
      .regex(TIME_STRING_PATTERN, "発生時刻の形式が正しくありません"),
    inputMethod: z.enum(["auto", "direct"], {
      error: "入力方法を選択してください",
    }),
    combinedWeightKg: optionalPositiveNumber(
      "人間を含んだ体重を入力してください",
    ),
    humanWeightKg: optionalPositiveNumber("人間だけの体重を入力してください"),
    catWeightKg: optionalPositiveNumber("猫の体重を入力してください"),
  })
  .refine(
    (data) =>
      data.inputMethod !== "auto" ||
      (data.combinedWeightKg != null && data.humanWeightKg != null),
    {
      message: "人間を含んだ体重と人間だけの体重を入力してください",
      path: ["combinedWeightKg"],
    },
  )
  .refine(
    (data) =>
      data.inputMethod !== "auto" ||
      data.combinedWeightKg == null ||
      data.humanWeightKg == null ||
      data.combinedWeightKg > data.humanWeightKg,
    {
      message: "人間を含んだ体重は人間だけの体重より大きい値にしてください",
      path: ["combinedWeightKg"],
    },
  )
  .refine((data) => data.inputMethod !== "direct" || data.catWeightKg != null, {
    message: "猫の体重を入力してください",
    path: ["catWeightKg"],
  });

export type WeightRecordFormInput = z.infer<typeof weightRecordFormSchema>;

export type WeightRecordFormFieldErrors = Partial<
  Record<keyof WeightRecordFormInput, string[]>
>;
