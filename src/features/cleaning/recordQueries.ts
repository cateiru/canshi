import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cleaningRecords } from "@/db/schema";

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
