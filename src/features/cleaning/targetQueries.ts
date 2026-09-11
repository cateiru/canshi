import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cleaningRecords, cleaningTargets } from "@/db/schema";
import { calculateNextDueAt, isCleaningOverdue } from "./calculations";

export type CleaningTargetWithStatus = {
  target: typeof cleaningTargets.$inferSelect;
  lastPerformedAt: Date | null;
  nextDueAt: Date | null;
  isOverdue: boolean;
};

export async function listCleaningTargets(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(cleaningTargets)
    .where(eq(cleaningTargets.catId, catId))
    .orderBy(asc(cleaningTargets.sortOrder));
}

export async function getCleaningTargetById(id: string) {
  const db = getDb();
  const [target] = await db
    .select()
    .from(cleaningTargets)
    .where(eq(cleaningTargets.id, id))
    .limit(1);
  return target ?? null;
}

/**
 * 猫の掃除対象一覧に、対象ごとの前回実施日・次回予定日・期限超過を付与して返す。
 * 個人利用規模の D1 を前提に、対象一覧と記録一覧を別々に取得して JS 側で結合する
 * （`src/features/timeline/queries.ts` と同じ方針）
 */
export async function listCleaningTargetsWithStatus(
  catId: string,
  now: Date,
): Promise<CleaningTargetWithStatus[]> {
  const db = getDb();
  const targets = await db
    .select()
    .from(cleaningTargets)
    .where(eq(cleaningTargets.catId, catId))
    .orderBy(asc(cleaningTargets.sortOrder));

  if (targets.length === 0) {
    return [];
  }

  const records = await db
    .select({
      cleaningTargetId: cleaningRecords.cleaningTargetId,
      performedAt: cleaningRecords.performedAt,
    })
    .from(cleaningRecords)
    .where(eq(cleaningRecords.catId, catId))
    .orderBy(desc(cleaningRecords.performedAt));

  const lastPerformedByTarget = new Map<string, Date>();
  for (const record of records) {
    if (!lastPerformedByTarget.has(record.cleaningTargetId)) {
      lastPerformedByTarget.set(record.cleaningTargetId, record.performedAt);
    }
  }

  return targets.map((target) => {
    const lastPerformedAt = lastPerformedByTarget.get(target.id) ?? null;
    const nextDueAt = calculateNextDueAt(
      lastPerformedAt,
      target.frequencyValue,
      target.frequencyUnit,
    );
    return {
      target,
      lastPerformedAt,
      nextDueAt,
      isOverdue: isCleaningOverdue(nextDueAt, now),
    };
  });
}
