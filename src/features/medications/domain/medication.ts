import type { Medication } from "@/db/schema";
import type { MedicationFormInput } from "./schema";

/** 服薬予定（エンティティ）。ID で区別し、猫（`catId`）に属する。投薬実績（`MedicationDose`）を持つ */
export type { Medication };

/** 服薬予定の中身。ID・猫・服薬歴へ移した日時・作成日時を除いたもの */
export type MedicationContent = Pick<
  Medication,
  | "symptomId"
  | "name"
  | "doseAmount"
  | "dosesPerDay"
  | "startDate"
  | "endDate"
  | "hospitalVisitId"
>;

/** 入力から服薬予定の中身を作る */
export function toMedicationContent(
  data: MedicationFormInput,
): MedicationContent {
  return {
    symptomId: data.symptomId ?? null,
    name: data.name,
    doseAmount: data.doseAmount,
    dosesPerDay: data.dosesPerDay,
    startDate: data.startDate,
    endDate: data.endDate ?? null,
    hospitalVisitId: data.hospitalVisitId ?? null,
  };
}
