import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type WaterRecord, waterRecords } from "@/db/schema";

export async function listWaterRecords(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(waterRecords)
    .where(and(eq(waterRecords.catId, catId), isNull(waterRecords.deletedAt)))
    .orderBy(desc(waterRecords.occurredAt));
}

export async function getWaterRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(waterRecords)
    .where(and(eq(waterRecords.id, id), isNull(waterRecords.deletedAt)))
    .limit(1);
  return record ?? null;
}

/** 猫の飲水の記録を ID で 1 件読む。別の猫の記録・見つからなければ null */
export async function getWaterRecordForCat(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<WaterRecord | null> {
  const [record] = await getDb(d1)
    .select()
    .from(waterRecords)
    .where(
      and(
        eq(waterRecords.id, id),
        eq(waterRecords.catId, catId),
        isNull(waterRecords.deletedAt),
      ),
    )
    .limit(1);
  return record ?? null;
}
