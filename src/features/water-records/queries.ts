import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { waterRecords } from "@/db/schema";

export async function listWaterRecords(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(waterRecords)
    .where(eq(waterRecords.catId, catId))
    .orderBy(desc(waterRecords.occurredAt));
}

export async function getWaterRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(waterRecords)
    .where(eq(waterRecords.id, id))
    .limit(1);
  return record ?? null;
}
