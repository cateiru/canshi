import type { Medication } from "@/db/schema";
import { getNaiveUtcNow } from "@/features/shared/datetime";

type MedicationHistoryFields = Pick<Medication, "endDate" | "archivedAt">;

/**
 * 終了予定日と比べるための「今日」（`YYYY-MM-DD`）。実際の UTC の日付を使うと
 * JST の 0〜9 時に前日扱いになるため、`getNaiveUtcNow` で JST の見た目に揃える
 */
export function getMedicationToday(now: Date = new Date()): string {
  return getNaiveUtcNow(now).toISOString().slice(0, 10);
}

/** 終了予定日を過ぎているか。終了予定日の当日はまだ服用中として扱う */
export function isMedicationEnded(
  medication: Pick<Medication, "endDate">,
  today: string,
): boolean {
  return medication.endDate != null && medication.endDate < today;
}

/**
 * 服薬歴に表示するか。「服薬歴に移す」で手動で移したもの、または終了予定日を
 * 過ぎたもの（自動）が服薬歴になる
 */
export function isMedicationInHistory(
  medication: MedicationHistoryFields,
  today: string,
): boolean {
  return medication.archivedAt != null || isMedicationEnded(medication, today);
}

/**
 * 服薬歴に移った日。手動で移した日と終了予定日のうち早いほうを使う。
 * 並べ替えにだけ使い、`YYYY-MM-DD` で比べられるようにする
 */
function historyDate(medication: MedicationHistoryFields): string {
  const archivedDate = medication.archivedAt?.toISOString().slice(0, 10);
  if (archivedDate == null) {
    return medication.endDate ?? "";
  }
  if (medication.endDate == null) {
    return archivedDate;
  }
  return archivedDate < medication.endDate ? archivedDate : medication.endDate;
}

/**
 * 服薬予定を、服用中のものと服薬歴に振り分ける。服用中は渡された順のまま、
 * 服薬歴は服薬歴に移った日の新しい順に並べる
 */
export function partitionMedications<T extends MedicationHistoryFields>(
  medications: T[],
  today: string,
): { current: T[]; history: T[] } {
  const current: T[] = [];
  const history: T[] = [];
  for (const medication of medications) {
    if (isMedicationInHistory(medication, today)) {
      history.push(medication);
    } else {
      current.push(medication);
    }
  }
  history.sort((a, b) => historyDate(b).localeCompare(historyDate(a)));
  return { current, history };
}
