import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type BrushingRecord, brushingRecords } from "@/db/schema";

export async function listBrushingRecords(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(brushingRecords)
    .where(eq(brushingRecords.catId, catId))
    .orderBy(desc(brushingRecords.performedAt));
}

export async function getBrushingRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(brushingRecords)
    .where(eq(brushingRecords.id, id))
    .limit(1);
  return record ?? null;
}

/** 猫のブラッシングの記録を ID で 1 件読む。別の猫の記録・見つからなければ null */
export async function getBrushingRecordForCat(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<BrushingRecord | null> {
  const [record] = await getDb(d1)
    .select()
    .from(brushingRecords)
    .where(and(eq(brushingRecords.id, id), eq(brushingRecords.catId, catId)))
    .limit(1);
  return record ?? null;
}
