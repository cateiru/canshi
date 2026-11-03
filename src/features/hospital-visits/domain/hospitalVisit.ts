import type { HospitalVisit } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { HospitalVisitFormInput } from "./schema";

/** 通院記録（エンティティ）。ID で区別し、猫（`catId`）に属する。病院代として支出記録と紐付く */
export type { HospitalVisit };

/** 通院記録の中身。ID・猫・作成日時を除いたもの */
export type HospitalVisitContent = Pick<
  HospitalVisit,
  | "symptomId"
  | "visitedAt"
  | "reason"
  | "diagnosis"
  | "examinationResults"
  | "treatment"
  | "nextVisitAt"
  | "memo"
>;

/**
 * 通院記録と同時に保存する病院代。`saveHospitalVisitWithExpense`
 * （`src/features/expenses/infrastructure/hospitalVisitExpense.ts`）を参照
 */
export type HospitalVisitExpenseChange = {
  /** 通院した猫の家。病院代の支出記録を新しく作るときは、この家の支出にする */
  householdId: string;
  /** 病院代。null のときは紐付く支出記録を削除する（他の通院記録と共有していれば紐付けだけ外す） */
  amountYen: number | null;
  /** 病院代を入力せずに、既存の支出記録へ紐付けるときの支出記録 ID */
  linkExpenseRecordId?: string | null;
  /** 病院代が空欄でも、この支出記録に紐付いていれば紐付けをそのまま維持する */
  keepLinkedExpenseRecordId?: string | null;
};

/** 入力から通院記録の中身を作る */
export function toHospitalVisitContent(
  data: HospitalVisitFormInput,
): HospitalVisitContent {
  return {
    symptomId: data.symptomId ?? null,
    visitedAt: combineDateTimeUtc(data.visitedDate, data.visitedTime),
    reason: data.reason,
    diagnosis: data.diagnosis ?? null,
    examinationResults: data.examinationResults ?? null,
    treatment: data.treatment ?? null,
    nextVisitAt:
      data.nextVisitDate != null && data.nextVisitTime != null
        ? combineDateTimeUtc(data.nextVisitDate, data.nextVisitTime)
        : null,
    memo: data.memo ?? null,
  };
}
