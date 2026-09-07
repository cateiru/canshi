import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { medications } from "@/db/schema";

export async function listMedications(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(medications)
    .where(eq(medications.catId, catId))
    .orderBy(desc(medications.startDate));
}

export async function getMedicationById(id: string) {
  const db = getDb();
  const [medication] = await db
    .select()
    .from(medications)
    .where(eq(medications.id, id))
    .limit(1);
  return medication ?? null;
}
