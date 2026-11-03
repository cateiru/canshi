import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type CleaningRecord, cleaningRecords } from "@/db/schema";

export async function listCleaningRecords(cleaningTargetId: string) {
  const db = getDb();
  return db
    .select()
    .from(cleaningRecords)
    .where(eq(cleaningRecords.cleaningTargetId, cleaningTargetId))
    .orderBy(desc(cleaningRecords.performedAt));
}

export async function getCleaningRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(cleaningRecords)
    .where(eq(cleaningRecords.id, id))
    .limit(1);
  return record ?? null;
}

/** 猫の掃除の記録を ID で 1 件読む。別の猫の記録・見つからなければ null */
export async function getCleaningRecordForCat(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<CleaningRecord | null> {
  const [record] = await getDb(d1)
    .select()
    .from(cleaningRecords)
    .where(and(eq(cleaningRecords.id, id), eq(cleaningRecords.catId, catId)))
    .limit(1);
  return record ?? null;
}
