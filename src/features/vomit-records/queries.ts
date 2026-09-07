import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { vomitRecords } from "@/db/schema";

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
