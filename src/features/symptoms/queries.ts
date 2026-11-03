import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type Symptom, symptoms } from "@/db/schema";

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

/** 猫の症状の記録を ID で 1 件読む。別の猫の記録・見つからなければ null */
export async function getSymptomForCat(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<Symptom | null> {
  const [record] = await getDb(d1)
    .select()
    .from(symptoms)
    .where(and(eq(symptoms.id, id), eq(symptoms.catId, catId)))
    .limit(1);
  return record ?? null;
}
