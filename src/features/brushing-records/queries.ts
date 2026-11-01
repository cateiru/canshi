import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { brushingRecords } from "@/db/schema";

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
