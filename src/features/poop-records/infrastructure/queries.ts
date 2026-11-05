import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type PoopRecord, poopRecords } from "@/db/schema";

export async function listPoopRecords(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(poopRecords)
    .where(and(eq(poopRecords.catId, catId), isNull(poopRecords.deletedAt)))
    .orderBy(desc(poopRecords.occurredAt));
}

export async function getPoopRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(poopRecords)
    .where(and(eq(poopRecords.id, id), isNull(poopRecords.deletedAt)))
    .limit(1);
  return record ?? null;
}

/** 猫のうんちの記録を ID で 1 件読む。別の猫の記録・見つからなければ null */
export async function getPoopRecordForCat(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<PoopRecord | null> {
  const [record] = await getDb(d1)
    .select()
    .from(poopRecords)
    .where(
      and(
        eq(poopRecords.id, id),
        eq(poopRecords.catId, catId),
        isNull(poopRecords.deletedAt),
      ),
    )
    .limit(1);
  return record ?? null;
}
