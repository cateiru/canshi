import { z } from "zod";
import { TIME_STRING_PATTERN } from "@/features/shared/datetime";
import { emptyToUndefined } from "@/features/shared/emptyToUndefined";

const optionalDate = (message: string) =>
  z.preprocess(emptyToUndefined, z.string().date(message).optional());

const optionalTime = (message: string) =>
  z.preprocess(
    emptyToUndefined,
    z.string().regex(TIME_STRING_PATTERN, message).optional(),
  );

export const hospitalVisitFormSchema = z
  .object({
    symptomId: z.preprocess(emptyToUndefined, z.string().optional()),
    reservedDate: optionalDate("予約日の形式が正しくありません"),
    reservedTime: optionalTime("予約時刻の形式が正しくありません"),
    visitedDate: z.string().date("受診日の形式が正しくありません"),
    visitedTime: z
      .string()
      .regex(TIME_STRING_PATTERN, "受診時刻の形式が正しくありません"),
    reason: z
      .string()
      .trim()
      .min(1, "受診理由を入力してください")
      .max(200, "受診理由は200文字以内で入力してください"),
    diagnosis: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .max(500, "診断・所見は500文字以内で入力してください")
        .optional(),
    ),
    examinationResults: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .max(500, "検査と結果は500文字以内で入力してください")
        .optional(),
    ),
    treatment: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .max(500, "注射・処置は500文字以内で入力してください")
        .optional(),
    ),
    nextVisitDate: optionalDate("次回受診予定日の形式が正しくありません"),
    nextVisitTime: optionalTime("次回受診予定時刻の形式が正しくありません"),
    memo: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .max(500, "備考は500文字以内で入力してください")
        .optional(),
    ),
  })
  .refine(
    (data) => (data.reservedDate == null) === (data.reservedTime == null),
    {
      message: "予約日と予約時刻はどちらも入力するか、どちらも空にしてください",
      path: ["reservedTime"],
    },
  )
  .refine(
    (data) => (data.nextVisitDate == null) === (data.nextVisitTime == null),
    {
      message:
        "次回受診予定日と時刻はどちらも入力するか、どちらも空にしてください",
      path: ["nextVisitTime"],
    },
  );

export type HospitalVisitFormInput = z.infer<typeof hospitalVisitFormSchema>;

export type HospitalVisitFormFieldErrors = Partial<
  Record<keyof HospitalVisitFormInput, string[]>
>;
