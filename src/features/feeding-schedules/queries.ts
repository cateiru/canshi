import { and, asc, eq, inArray } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import { type FeedingSchedule, feedingSchedules } from "@/db/schema";

/*
 * ごはんの時間の読み取り。家に所属しているか（読み取りを許可しているか）は呼び出し側で確かめる
 */

/** 家のごはんの時間の一覧。時刻順 */
export async function listFeedingSchedules(
  householdId: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  return db
    .select()
    .from(feedingSchedules)
    .where(eq(feedingSchedules.householdId, householdId))
    .orderBy(asc(feedingSchedules.time));
}

/** 複数の家のごはんの時間。家の ID・時刻の順に並べる */
export async function listFeedingSchedulesByHouseholdIds(
  householdIds: string[],
  d1?: D1Database,
): Promise<FeedingSchedule[]> {
  const db = getDb(d1);
  const schedules: FeedingSchedule[] = [];
  for (const ids of chunkForBoundParameters(householdIds)) {
    schedules.push(
      ...(await db
        .select()
        .from(feedingSchedules)
        .where(inArray(feedingSchedules.householdId, ids))),
    );
  }
  return schedules.sort(
    (a, b) =>
      a.householdId.localeCompare(b.householdId) ||
      a.time.localeCompare(b.time),
  );
}

/** ごはんの時間を ID で 1 件読む。見つからなければ null */
export async function getFeedingSchedule(
  id: string,
  d1?: D1Database,
): Promise<FeedingSchedule | null> {
  const [schedule] = await getDb(d1)
    .select()
    .from(feedingSchedules)
    .where(eq(feedingSchedules.id, id))
    .limit(1);
  return schedule ?? null;
}

/** 家の、指定した時刻のごはんの時間（同じ家に同じ時刻は 1 つだけ）。見つからなければ null */
export async function getFeedingScheduleByTime(
  householdId: string,
  time: string,
  d1?: D1Database,
): Promise<FeedingSchedule | null> {
  const [schedule] = await getDb(d1)
    .select()
    .from(feedingSchedules)
    .where(
      and(
        eq(feedingSchedules.householdId, householdId),
        eq(feedingSchedules.time, time),
      ),
    )
    .limit(1);
  return schedule ?? null;
}
