import { describe, expect, it } from "vitest";
import { evaluateFeedingSchedule } from "./feedingSchedule";
import type { FeedingScheduleForRule } from "./types";

function makeSchedule(
  overrides: Partial<FeedingScheduleForRule> = {},
): FeedingScheduleForRule {
  return {
    id: "schedule-1",
    time: "07:00",
    notifyAtTime: true,
    remindIfNotRecorded: true,
    ...overrides,
  };
}

const morning = makeSchedule({ id: "morning", time: "07:00" });
const evening = makeSchedule({ id: "evening", time: "19:00" });

// タイムゾーンは Asia/Tokyo（UTC+9）で判定する。ごはん記録の発生日時は naive UTC
// （日本時間の時計の数字をそのまま UTC として持つ）
function evaluate(
  now: string,
  schedules: FeedingScheduleForRule[],
  recentFeedingAts: string[] = [],
) {
  return evaluateFeedingSchedule(
    "home",
    new Date(now),
    "Asia/Tokyo",
    schedules,
    recentFeedingAts.map((at) => new Date(at)),
  );
}

describe("evaluateFeedingSchedule", () => {
  it("ごはんの時刻になったら、ごはんの時間の通知を返す", () => {
    // 日本時間 2026-09-11 07:00
    const candidates = evaluate("2026-09-10T22:00:00.000Z", [morning, evening]);
    expect(candidates).toEqual([
      {
        householdId: "home",
        kind: "feeding_time",
        referenceId: "morning",
        dedupeKey: "household:home:feeding_time:morning:2026-09-11",
        dueAt: new Date("2026-09-11T07:00:00.000Z"),
        time: "07:00",
      },
    ]);
  });

  it("ごはんの時刻より前は通知しない", () => {
    // 日本時間 06:45
    expect(evaluate("2026-09-10T21:45:00.000Z", [morning, evening])).toEqual(
      [],
    );
  });

  it("時刻を 1 時間以上過ぎたら、ごはんの時間の通知は出さない（設定した直後に古い通知を出さない）", () => {
    // 日本時間 08:00
    expect(evaluate("2026-09-10T23:00:00.000Z", [morning, evening])).toEqual(
      [],
    );
    // 日本時間 07:45 はまだ出す
    expect(
      evaluate("2026-09-10T22:45:00.000Z", [morning, evening]).map(
        (c) => c.kind,
      ),
    ).toEqual(["feeding_time"]);
  });

  it("時刻の前後の範囲にすでに記録があれば、ごはんの時間の通知は出さない", () => {
    // 日本時間 07:00。06:40 に記録済み
    expect(
      evaluate(
        "2026-09-10T22:00:00.000Z",
        [morning, evening],
        ["2026-09-11T06:40:00.000Z"],
      ),
    ).toEqual([]);
  });

  it("前の時刻との中間より前の記録は、範囲内の記録として扱わない", () => {
    // 日本時間 07:00。前の時刻（前日 19:00）との中間は 01:00 で、00:30 の記録は前の回のもの
    expect(
      evaluate(
        "2026-09-10T22:00:00.000Z",
        [morning, evening],
        ["2026-09-11T00:30:00.000Z"],
      ).map((c) => c.kind),
    ).toEqual(["feeding_time"]);
  });

  it("次の時刻との中間になっても記録がなければ、リマインダーを返す", () => {
    // 日本時間 13:00（07:00 と 19:00 の中間）
    expect(evaluate("2026-09-11T04:00:00.000Z", [morning, evening])).toEqual([
      {
        householdId: "home",
        kind: "feeding_not_recorded",
        referenceId: "morning",
        dedupeKey: "household:home:feeding_not_recorded:morning:2026-09-11",
        dueAt: new Date("2026-09-11T07:00:00.000Z"),
        time: "07:00",
      },
    ]);
  });

  it("範囲内に記録があればリマインダーを出さない", () => {
    // 日本時間 13:00。08:10 に記録済み
    expect(
      evaluate(
        "2026-09-11T04:00:00.000Z",
        [morning, evening],
        ["2026-09-11T08:10:00.000Z"],
      ),
    ).toEqual([]);
  });

  it("中間の時刻が翌日になる回は、ごはんの日付で重複を防ぐ", () => {
    // 日本時間 2026-09-12 01:00（前日 19:00 と 07:00 の中間）
    expect(evaluate("2026-09-11T16:00:00.000Z", [morning, evening])).toEqual([
      {
        householdId: "home",
        kind: "feeding_not_recorded",
        referenceId: "evening",
        dedupeKey: "household:home:feeding_not_recorded:evening:2026-09-11",
        dueAt: new Date("2026-09-11T19:00:00.000Z"),
        time: "19:00",
      },
    ]);
  });

  it("日付をまたいだ直後でも、前日の時刻の通知を返す", () => {
    const lateNight = makeSchedule({ id: "late", time: "23:30" });
    // 日本時間 2026-09-12 00:15
    expect(evaluate("2026-09-11T15:15:00.000Z", [lateNight])).toEqual([
      expect.objectContaining({
        kind: "feeding_time",
        dedupeKey: "household:home:feeding_time:late:2026-09-11",
      }),
    ]);
  });

  it("時刻が 1 つだけなら、前後 12 時間を範囲にする", () => {
    // 日本時間 19:00（07:00 の 12 時間後）
    expect(
      evaluate("2026-09-11T10:00:00.000Z", [morning]).map((c) => c.kind),
    ).toEqual(["feeding_not_recorded"]);
    // 前日 19:30 の記録は範囲内（07:00 の 12 時間前の 19:00 以降）
    expect(
      evaluate(
        "2026-09-11T10:00:00.000Z",
        [morning],
        ["2026-09-10T19:30:00.000Z"],
      ),
    ).toEqual([]);
    // 前日 18:30 の記録は範囲外
    expect(
      evaluate(
        "2026-09-11T10:00:00.000Z",
        [morning],
        ["2026-09-10T18:30:00.000Z"],
      ).map((c) => c.kind),
    ).toEqual(["feeding_not_recorded"]);
  });

  it("中間の時刻が 15 分刻みでなくても、次のスケジュール実行でリマインダーを返す", () => {
    const first = makeSchedule({ id: "first", time: "07:00" });
    const second = makeSchedule({ id: "second", time: "07:15" });
    // 07:00 と 07:15 の中間は 07:07:30。日本時間 07:15 の実行で出す
    // （07:00 の時刻の通知は 07:00 の実行で生成済みで、`dedupe_key` で重複しない）
    expect(
      evaluate("2026-09-10T22:15:00.000Z", [first, second]).map((c) => [
        c.kind,
        c.referenceId,
      ]),
    ).toEqual([
      ["feeding_time", "first"],
      ["feeding_not_recorded", "first"],
      ["feeding_time", "second"],
    ]);
  });

  it("時刻の通知・リマインダーを無効にした時間は、それぞれ出さない", () => {
    expect(
      evaluate("2026-09-10T22:00:00.000Z", [
        { ...morning, notifyAtTime: false },
        evening,
      ]),
    ).toEqual([]);
    expect(
      evaluate("2026-09-11T04:00:00.000Z", [
        { ...morning, remindIfNotRecorded: false },
        evening,
      ]),
    ).toEqual([]);
  });

  it("ごはんの時間がなければ何も返さない", () => {
    expect(evaluate("2026-09-10T22:00:00.000Z", [])).toEqual([]);
  });
});
