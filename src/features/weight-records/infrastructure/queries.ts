import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type WeightRecord, weightRecords } from "@/db/schema";

export async function listWeightRecords(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(weightRecords)
    .where(and(eq(weightRecords.catId, catId), isNull(weightRecords.deletedAt)))
    .orderBy(desc(weightRecords.occurredAt));
}

export async function getWeightRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(weightRecords)
    .where(and(eq(weightRecords.id, id), isNull(weightRecords.deletedAt)))
    .limit(1);
  return record ?? null;
}

/** 猫の体重の記録を ID で 1 件読む。別の猫の記録・見つからなければ null */
export async function getWeightRecordForCat(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<WeightRecord | null> {
  const [record] = await getDb(d1)
    .select()
    .from(weightRecords)
    .where(
      and(
        eq(weightRecords.id, id),
        eq(weightRecords.catId, catId),
        isNull(weightRecords.deletedAt),
      ),
    )
    .limit(1);
  return record ?? null;
}
