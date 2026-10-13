import {
  addDays,
  getLocalDateParts,
  getNaiveLocalNow,
  type LocalDate,
  localDateKey,
} from "./localDate";
import type {
  FeedingScheduleForRule,
  HouseholdNotificationCandidate,
} from "./types";

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/**
 * 通知を出してよい、通知時刻からの猶予。スケジュール実行は 15 分ごとのため、それより長くする。
 * 時刻を大きく過ぎてから通知を出さないよう（ごはんの時間を設定した直後に、その日の過ぎた時間の
 * 通知が出るなど）、この猶予を過ぎたら出さない
 */
export const FEEDING_NOTIFY_GRACE_MS = 60 * MS_PER_MINUTE;

/**
 * ごはん記録を探す範囲として、判定に必要な期間。範囲の始まりは最も早くて前日のごはんの時刻の
 * 12 時間前のため、それより長くとる（`generate.ts` がこの期間の記録を取得する）
 */
export const FEEDING_RECORD_LOOKBACK_MS = 2 * MS_PER_DAY;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function atLocalDate(date: LocalDate, minutes: number): number {
  return (
    Date.UTC(date.year, date.month - 1, date.day) + minutes * MS_PER_MINUTE
  );
}

/**
 * 家のごはんの時間の通知と、記録がないときのリマインダーを判定する。通知は猫ごとではなく
 * 家に 1 件だけ出す（家のメンバーに猫の数だけ届かないようにするため）。
 *
 * 家のごはんの時間を時刻順に並べ、各時刻の「前後の範囲」を、前の時刻との中間から次の時刻との
 * 中間までとする（時刻が 1 つだけなら前後 12 時間）。日付をまたいで、最後の時刻の次は翌日の
 * 最初の時刻になる。範囲は始まりを含み終わりを含まない半開区間とし、1 件の記録が隣り合う
 * 2 つの時刻の両方に数えられないようにする。`recentFeedingAts` は家の猫すべてのごはん記録で、
 * どれかの猫の記録が範囲内にあれば「記録がある」とみなす。
 * - 時刻になったら「ごはんの時間です」を出す。すでに範囲内に記録があれば出さない。判定する
 *   時刻より後の記録（先の日時で入力されたもの）は、まだあげていないため数えない。次の時刻との
 *   中間を過ぎたらリマインダーに切り替わるため、猶予の途中でも出さない
 * - 次の時刻との中間になっても範囲内に記録がなければ「ごはんはあげましたか？」を出す
 *
 * ごはん記録の発生日時は naive UTC（`localDate.ts` のコメント参照）のため、`now` も
 * ローカル時計の数字の naive UTC にして比べる。中間の時刻は日付をまたぐことがあるため、
 * 今日と昨日の回をそれぞれ判定する。重複して生成しないよう、`dedupe_key` には通知を出した
 * 日ではなく、その回のごはんの日付を含める
 */
export function evaluateFeedingSchedule(
  householdId: string,
  now: Date,
  timezone: string,
  schedules: FeedingScheduleForRule[],
  recentFeedingAts: Date[],
): HouseholdNotificationCandidate[] {
  if (schedules.length === 0) {
    return [];
  }

  const nowAt = getNaiveLocalNow(now, timezone).getTime();
  const today = getLocalDateParts(now, timezone);
  const sorted = [...schedules].sort(
    (a, b) => toMinutes(a.time) - toMinutes(b.time),
  );
  const feedingTimes = recentFeedingAts.map((at) => at.getTime());
  const isRecordedIn = (window: { start: Date; end: Date }) =>
    feedingTimes.some(
      (at) => at >= window.start.getTime() && at < window.end.getTime(),
    );
  const candidates: HouseholdNotificationCandidate[] = [];

  for (const [index, schedule] of sorted.entries()) {
    const minutes = toMinutes(schedule.time);
    // 前後の時刻（その日の中での分）。範囲の外側になる場合は前日・翌日の時刻として 1 日ずらす
    const prevMinutes =
      index === 0
        ? toMinutes(sorted[sorted.length - 1].time) - 24 * 60
        : toMinutes(sorted[index - 1].time);
    const nextMinutes =
      index === sorted.length - 1
        ? toMinutes(sorted[0].time) + 24 * 60
        : toMinutes(sorted[index + 1].time);

    for (const date of [today, addDays(today, -1)]) {
      const slotAt = atLocalDate(date, minutes);
      const windowStart = atLocalDate(date, (prevMinutes + minutes) / 2);
      const reminderAt = atLocalDate(date, (minutes + nextMinutes) / 2);
      const dateKey = localDateKey(date);
      const base = {
        householdId,
        referenceId: schedule.id,
        dueAt: new Date(slotAt),
        time: schedule.time,
      };

      // 時刻の通知は、猶予の間か次の時刻との中間までの早いほうまで出す（時刻が近いと猶予が
      // 中間を越え、1 回の実行で時刻の通知とリマインダーの両方を出してしまうため）
      if (
        schedule.notifyAtTime &&
        nowAt >= slotAt &&
        nowAt < Math.min(slotAt + FEEDING_NOTIFY_GRACE_MS, reminderAt)
      ) {
        // 判定する時刻ちょうどの記録も含めるため、半開区間の終わりを 1 ミリ秒後にする
        const recordWindow = {
          start: new Date(windowStart),
          end: new Date(nowAt + 1),
        };
        if (!isRecordedIn(recordWindow)) {
          candidates.push({
            ...base,
            kind: "feeding_time",
            dedupeKey: `household:${householdId}:feeding_time:${schedule.id}:${dateKey}`,
            recordWindow,
          });
        }
      }

      if (
        schedule.remindIfNotRecorded &&
        nowAt >= reminderAt &&
        nowAt < reminderAt + FEEDING_NOTIFY_GRACE_MS
      ) {
        const recordWindow = {
          start: new Date(windowStart),
          end: new Date(reminderAt),
        };
        if (!isRecordedIn(recordWindow)) {
          candidates.push({
            ...base,
            kind: "feeding_not_recorded",
            dedupeKey: `household:${householdId}:feeding_not_recorded:${schedule.id}:${dateKey}`,
            recordWindow,
          });
        }
      }
    }
  }

  return candidates;
}
