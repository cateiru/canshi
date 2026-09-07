import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { medicationDoses } from "@/db/schema";

export async function listMedicationDoses(medicationId: string) {
  const db = getDb();
  return db
    .select()
    .from(medicationDoses)
    .where(eq(medicationDoses.medicationId, medicationId))
    .orderBy(desc(medicationDoses.occurredAt));
}

export async function getMedicationDoseById(id: string) {
  const db = getDb();
  const [dose] = await db
    .select()
    .from(medicationDoses)
    .where(eq(medicationDoses.id, id))
    .limit(1);
  return dose ?? null;
}
