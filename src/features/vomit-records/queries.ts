import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type VomitRecord, vomitRecords } from "@/db/schema";

export async function listVomitRecords(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(vomitRecords)
    .where(eq(vomitRecords.catId, catId))
    .orderBy(desc(vomitRecords.occurredAt));
}

export async function getVomitRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(vomitRecords)
    .where(eq(vomitRecords.id, id))
    .limit(1);
  return record ?? null;
}

/** 猫の嘔吐の記録を ID で 1 件読む。別の猫の記録・見つからなければ null */
export async function getVomitRecordForCat(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<VomitRecord | null> {
  const [record] = await getDb(d1)
    .select()
    .from(vomitRecords)
    .where(and(eq(vomitRecords.id, id), eq(vomitRecords.catId, catId)))
    .limit(1);
  return record ?? null;
}
