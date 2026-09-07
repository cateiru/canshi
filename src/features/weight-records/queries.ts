import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { weightRecords } from "@/db/schema";

export async function listWeightRecords(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(weightRecords)
    .where(eq(weightRecords.catId, catId))
    .orderBy(desc(weightRecords.occurredAt));
}

export async function getWeightRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(weightRecords)
    .where(eq(weightRecords.id, id))
    .limit(1);
  return record ?? null;
}
