/**
 * 服薬の期間（値オブジェクト）。開始日と終了予定日（`YYYY-MM-DD`）。終了予定日がなければ続ける
 */
export type MedicationPeriod = Readonly<{
  startDate: string;
  endDate: string | null;
}>;

/** 期間を作る。終了予定日は開始日以降であること（入力の規則は `./schema.ts` で確かめる） */
export function medicationPeriod(
  startDate: string,
  endDate: string | null | undefined,
): MedicationPeriod {
  return { startDate, endDate: endDate ?? null };
}

/** 終了予定日を過ぎているか。終了予定日の当日はまだ服用中として扱う */
export function isPeriodEnded(
  period: Pick<MedicationPeriod, "endDate">,
  today: string,
): boolean {
  return period.endDate != null && period.endDate < today;
}
