import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { poopRecords } from "@/db/schema";

export async function listPoopRecords(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(poopRecords)
    .where(eq(poopRecords.catId, catId))
    .orderBy(desc(poopRecords.occurredAt));
}

export async function getPoopRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(poopRecords)
    .where(eq(poopRecords.id, id))
    .limit(1);
  return record ?? null;
}
