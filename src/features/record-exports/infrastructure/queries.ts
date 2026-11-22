import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  RUNNING_RECORD_EXPORT_STATUSES,
  recordExports,
  users,
} from "@/db/schema";
import { recordExportStaleBefore } from "../domain/recordExport";

/** 出力の一覧に出す件数の上限。古いものは表示しない（削除はしない） */
export const RECORD_EXPORT_LIST_LIMIT = 50;

/** 家の記録の出力を新しい順に返す。依頼したユーザーの名前を添える */
export async function listRecordExports(householdId: string, d1?: D1Database) {
  const db = getDb(d1);
  return (
    db
      .select({
        id: recordExports.id,
        recordTypes: recordExports.recordTypes,
        includeMedia: recordExports.includeMedia,
        status: recordExports.status,
        failureReason: recordExports.failureReason,
        sizeBytes: recordExports.sizeBytes,
        createdAt: recordExports.createdAt,
        finishedAt: recordExports.finishedAt,
        requestedByName: users.name,
      })
      .from(recordExports)
      .innerJoin(users, eq(users.id, recordExports.requestedByUserId))
      .where(eq(recordExports.householdId, householdId))
      // created_at は秒単位のため、同じ秒に作られたものは rowid（作った順）で並べる
      .orderBy(desc(recordExports.createdAt), desc(sql`${recordExports}.rowid`))
      .limit(RECORD_EXPORT_LIST_LIMIT)
  );
}

export type RecordExportListItem = Awaited<
  ReturnType<typeof listRecordExports>
>[number];

/** 家の出力を 1 件返す。別の家の出力なら null */
export async function getRecordExport(
  householdId: string,
  recordExportId: string,
  d1?: D1Database,
) {
  const db = getDb(d1);
  const [row] = await db
    .select()
    .from(recordExports)
    .where(
      and(
        eq(recordExports.id, recordExportId),
        eq(recordExports.householdId, householdId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * 家に処理中の出力があるか。処理中のまま止まった出力（`RECORD_EXPORT_STALE_AFTER_MS` を過ぎたもの）は
 * 数えない（画面では失敗として表示する）
 */
export async function hasRunningRecordExport(
  householdId: string,
  now: Date,
  d1?: D1Database,
): Promise<boolean> {
  const db = getDb(d1);
  const [row] = await db
    .select({ id: recordExports.id })
    .from(recordExports)
    .where(
      and(
        eq(recordExports.householdId, householdId),
        inArray(recordExports.status, [...RUNNING_RECORD_EXPORT_STATUSES]),
        gte(recordExports.createdAt, recordExportStaleBefore(now)),
      ),
    )
    .limit(1);
  return row != null;
}
