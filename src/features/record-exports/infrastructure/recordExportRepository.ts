import { and, eq, inArray, lt, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { insertWhere } from "@/db/conditionalInsert";
import { RUNNING_RECORD_EXPORT_STATUSES, recordExports } from "@/db/schema";
import { isHouseholdMemberCondition } from "@/features/households/infrastructure/queries";
import type { RecordExportRepository } from "../domain/recordExportRepository";

const RUNNING = [...RUNNING_RECORD_EXPORT_STATUSES];

/** D1 で実装した記録の出力のリポジトリ。省略すると `getCloudflareContext()` の D1 を使う */
export function createRecordExportRepository(
  d1?: D1Database,
): RecordExportRepository {
  const db = getDb(d1);

  return {
    async addForMember(householdId, userId, request, staleBefore) {
      const isMember = isHouseholdMemberCondition(householdId, userId);
      const [, created] = await db.batch([
        // バッチが止まって処理中のまま残った出力を失敗にし、新しい出力を依頼できるようにする
        db
          .update(recordExports)
          .set({
            status: "failed",
            failureReason: "error",
            finishedAt: new Date(),
          })
          .where(
            and(
              eq(recordExports.householdId, householdId),
              inArray(recordExports.status, RUNNING),
              lt(recordExports.createdAt, staleBefore),
              isMember,
            ),
          ),
        // 処理中の出力は家ごとに 1 件だけ。判定と同時に依頼されても、部分一意インデックスで
        // 2 件目は何もしない
        insertWhere(
          db,
          recordExports,
          {
            householdId,
            requestedByUserId: userId,
            recordTypes: request.recordTypes,
            includeMedia: request.includeMedia,
            status: "pending",
          },
          and(
            isMember,
            sql`NOT EXISTS (
              SELECT 1 FROM ${recordExports}
              WHERE ${recordExports.householdId} = ${householdId}
                AND ${inArray(recordExports.status, RUNNING)}
            )`,
          ),
        )
          .onConflictDoNothing()
          .returning({ id: recordExports.id }),
      ]);
      return created[0]?.id ?? null;
    },

    async markProcessing(recordExportId) {
      const [updated] = await db
        .update(recordExports)
        .set({ status: "processing" })
        .where(
          and(
            eq(recordExports.id, recordExportId),
            inArray(recordExports.status, RUNNING),
          ),
        )
        .returning();
      return updated ?? null;
    },

    async markCompleted(recordExportId, objectKey, sizeBytes) {
      const updated = await db
        .update(recordExports)
        .set({
          status: "completed",
          objectKey,
          sizeBytes,
          finishedAt: new Date(),
        })
        .where(
          and(
            eq(recordExports.id, recordExportId),
            eq(recordExports.status, "processing"),
          ),
        )
        .returning({ id: recordExports.id });
      return updated.length > 0;
    },

    async markFailed(recordExportId, reason) {
      await db
        .update(recordExports)
        .set({
          status: "failed",
          failureReason: reason,
          finishedAt: new Date(),
        })
        .where(
          and(
            eq(recordExports.id, recordExportId),
            inArray(recordExports.status, RUNNING),
          ),
        );
    },

    async removeForMember(householdId, userId, recordExportId, staleBefore) {
      const [removed] = await db
        .delete(recordExports)
        .where(
          and(
            eq(recordExports.id, recordExportId),
            eq(recordExports.householdId, householdId),
            // 処理中の出力は消さない（バッチが作った zip が残ってしまうため）。処理中のまま
            // 止まった出力は、画面で失敗として表示しているため消せるようにする
            or(
              notInArray(recordExports.status, RUNNING),
              lt(recordExports.createdAt, staleBefore),
            ),
            isHouseholdMemberCondition(householdId, userId),
          ),
        )
        .returning({ objectKey: recordExports.objectKey });
      return removed ?? null;
    },
  };
}
