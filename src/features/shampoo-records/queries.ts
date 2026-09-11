import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { shampooRecords } from "@/db/schema";

export async function listShampooRecords(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(shampooRecords)
    .where(eq(shampooRecords.catId, catId))
    .orderBy(desc(shampooRecords.performedAt));
}

export async function getShampooRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(shampooRecords)
    .where(eq(shampooRecords.id, id))
    .limit(1);
  return record ?? null;
}
