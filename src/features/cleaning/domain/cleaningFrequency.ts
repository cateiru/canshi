import type { CleaningTarget } from "@/db/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type CleaningFrequencyUnit = CleaningTarget["frequencyUnit"];

/**
 * 掃除の頻度（値オブジェクト）。「N 日ごと」「N か月ごと」。次回の予定日はここから求める
 */
export type CleaningFrequency = Readonly<{
  value: number;
  unit: CleaningFrequencyUnit;
}>;

/** 頻度を作る。値は 1 以上の整数であること（入力の規則は `./targetSchema.ts` で確かめる） */
export function cleaningFrequency(
  value: number,
  unit: CleaningFrequencyUnit,
): CleaningFrequency {
  return { value, unit };
}

/** 掃除対象の列から頻度を読む */
export function cleaningFrequencyOf(
  target: Pick<CleaningTarget, "frequencyValue" | "frequencyUnit">,
): CleaningFrequency {
  return cleaningFrequency(target.frequencyValue, target.frequencyUnit);
}

/**
 * 前回の実施日時から数えた次回の予定日時。
 *
 * 単位が「月」の場合は日数換算（例: 30日固定）ではなく暦月で加算する
 * （前回実施日と同じ日を N ヶ月後にする）。存在しない日（例: 1/31 の1ヶ月後）は
 * `Date` の仕様に従い翌月に繰り越す（1/31 → 3/3 など）。
 *
 * 通知時刻（`notifyTime`、HH:MM）が指定されている場合は、予定日の日付はそのままに
 * 時刻だけを通知時刻に揃える（例: 毎日 23:00 の対象を 23:10 に実施したら、次回は翌日 23:00）。
 * 実施日時と同じく naive UTC のため、UTC フィールドをそのまま書き換える
 */
export function nextDueAfter(
  frequency: CleaningFrequency,
  lastPerformedAt: Date,
  notifyTime: string | null = null,
): Date {
  let nextDueAt: Date;
  if (frequency.unit === "months") {
    nextDueAt = new Date(lastPerformedAt.getTime());
    nextDueAt.setUTCMonth(nextDueAt.getUTCMonth() + frequency.value);
  } else {
    nextDueAt = new Date(
      lastPerformedAt.getTime() + frequency.value * MS_PER_DAY,
    );
  }
  if (notifyTime != null) {
    const [hours, minutes] = notifyTime.split(":").map(Number);
    nextDueAt.setUTCHours(hours, minutes, 0, 0);
  }
  return nextDueAt;
}
