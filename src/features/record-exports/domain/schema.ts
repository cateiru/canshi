import { z } from "zod";
import { checkboxBooleanSchema } from "@/features/shared/checkbox";
import {
  isRecordExportType,
  normalizeRecordExportTypes,
  type RecordExportType,
} from "./recordExport";

/** 記録の出力のフォームの入力 */
export const recordExportFormSchema = z.object({
  recordTypes: z
    .array(z.string())
    .transform((types, ctx): RecordExportType[] => {
      if (!types.every(isRecordExportType)) {
        ctx.addIssue({
          code: "custom",
          message: "出力できない記録の種類が含まれています",
        });
        return z.NEVER;
      }
      return normalizeRecordExportTypes(types);
    })
    .refine((types) => types.length > 0, {
      message: "出力する記録を 1 つ以上選んでください",
    }),
  includeMedia: checkboxBooleanSchema,
});

export type RecordExportFormInput = z.infer<typeof recordExportFormSchema>;

export type RecordExportFormFieldErrors = Partial<
  Record<keyof RecordExportFormInput, string[]>
>;
