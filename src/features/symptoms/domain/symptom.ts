import type { Symptom } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { SymptomFormInput } from "./schema";

/** 症状の記録（エンティティ）。ID で区別し、猫（`catId`）に属する */
export type { Symptom };

/** 症状の記録の中身。ID・猫・作成日時を除いたもの */
export type SymptomContent = Pick<
  Symptom,
  | "symptomType"
  | "onsetAt"
  | "frequencyOrSeverity"
  | "appetiteNote"
  | "energyNote"
  | "status"
  | "hospitalVisitId"
  | "memo"
>;

/** 入力から症状の記録の中身を作る */
export function toSymptomContent(data: SymptomFormInput): SymptomContent {
  return {
    symptomType: data.symptomType,
    onsetAt: combineDateTimeUtc(data.onsetDate, data.onsetTime),
    frequencyOrSeverity: data.frequencyOrSeverity ?? null,
    appetiteNote: data.appetiteNote ?? null,
    energyNote: data.energyNote ?? null,
    status: data.status,
    hospitalVisitId: data.hospitalVisitId ?? null,
    memo: data.memo ?? null,
  };
}
