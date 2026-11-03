import { describe, expect, it } from "vitest";
import { groupRecordsByDate } from "./groupByDate";

type Item = { id: string; occurredAt: Date };

function record(id: string, iso: string): Item {
  return { id, occurredAt: new Date(iso) };
}

describe("groupRecordsByDate", () => {
  it("同じ日付が連続する記録を1つのグループにまとめる", () => {
    const records = [
      record("a", "2026-09-11T20:12:00.000Z"),
      record("b", "2026-09-11T08:00:00.000Z"),
      record("c", "2026-09-09T20:12:00.000Z"),
    ];

    const groups = groupRecordsByDate(records);

    expect(groups).toEqual([
      { dateKey: "2026-09-11", records: [records[0], records[1]] },
      { dateKey: "2026-09-09", records: [records[2]] },
    ]);
  });

  it("グループの並び順は入力の並び順を維持する", () => {
    const records = [
      record("a", "2026-09-01T00:00:00.000Z"),
      record("b", "2026-09-05T00:00:00.000Z"),
    ];

    const groups = groupRecordsByDate(records);

    expect(groups.map((g) => g.dateKey)).toEqual(["2026-09-01", "2026-09-05"]);
  });

  it("日付境界をまたぐ時刻でも日付単位で正しく分ける（23:30 と翌 00:30）", () => {
    const records = [
      record("a", "2026-09-02T00:30:00.000Z"),
      record("b", "2026-09-01T23:30:00.000Z"),
    ];

    const groups = groupRecordsByDate(records);

    expect(groups).toEqual([
      { dateKey: "2026-09-02", records: [records[0]] },
      { dateKey: "2026-09-01", records: [records[1]] },
    ]);
  });

  it("空配列を渡すと空配列を返す", () => {
    expect(groupRecordsByDate([])).toEqual([]);
  });
});
