import type { MedicationDose } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { MedicationDoseFormInput } from "./doseSchema";

/** 投薬実績（エンティティ）。服薬予定（`Medication`）に属する */
export type { MedicationDose };

/** 投薬実績の中身。ID・猫・服薬予定・作成日時を除いたもの */
export type MedicationDoseContent = Pick<
  MedicationDose,
  "occurredAt" | "wasAdministered" | "memo"
>;

/** 入力から投薬実績の中身を作る */
export function toMedicationDoseContent(
  data: MedicationDoseFormInput,
): MedicationDoseContent {
  return {
    occurredAt: combineDateTimeUtc(data.occurredDate, data.occurredTime),
    wasAdministered: data.wasAdministered,
    memo: data.memo ?? null,
  };
}
