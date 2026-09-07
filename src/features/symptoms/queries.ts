import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { symptoms } from "@/db/schema";

export async function listSymptoms(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(symptoms)
    .where(eq(symptoms.catId, catId))
    .orderBy(desc(symptoms.onsetAt));
}

export async function getSymptomById(id: string) {
  const db = getDb();
  const [symptom] = await db
    .select()
    .from(symptoms)
    .where(eq(symptoms.id, id))
    .limit(1);
  return symptom ?? null;
}
