export type FeedingRecordDateGroup<T> = {
  dateKey: string;
  records: T[];
};

/**
 * listFeedingRecords()（occurredAt 降順）の結果を、一覧に日付区切りを
 * 表示するために日付単位でグルーピングする。入力は既に occurredAt 降順で
 * あることを前提に、同じ日付の記録が連続している間だけ同じグループへ
 * まとめる（呼び出し側で並べ替えは行わない）。
 */
export function groupRecordsByDate<T extends { occurredAt: Date }>(
  records: T[],
): FeedingRecordDateGroup<T>[] {
  const groups: FeedingRecordDateGroup<T>[] = [];

  for (const record of records) {
    const dateKey = record.occurredAt.toISOString().slice(0, 10);
    const lastGroup = groups.at(-1);
    if (lastGroup && lastGroup.dateKey === dateKey) {
      lastGroup.records.push(record);
    } else {
      groups.push({ dateKey, records: [record] });
    }
  }

  return groups;
}
