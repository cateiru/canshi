import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type ShampooRecord, shampooRecords } from "@/db/schema";

export async function listShampooRecords(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(shampooRecords)
    .where(
      and(eq(shampooRecords.catId, catId), isNull(shampooRecords.deletedAt)),
    )
    .orderBy(desc(shampooRecords.performedAt));
}

export async function getShampooRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(shampooRecords)
    .where(and(eq(shampooRecords.id, id), isNull(shampooRecords.deletedAt)))
    .limit(1);
  return record ?? null;
}

/** 猫のシャンプーの記録を ID で 1 件読む。別の猫の記録・見つからなければ null */
export async function getShampooRecordForCat(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<ShampooRecord | null> {
  const [record] = await getDb(d1)
    .select()
    .from(shampooRecords)
    .where(
      and(
        eq(shampooRecords.id, id),
        eq(shampooRecords.catId, catId),
        isNull(shampooRecords.deletedAt),
      ),
    )
    .limit(1);
  return record ?? null;
}
