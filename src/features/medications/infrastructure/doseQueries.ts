import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type MedicationDose, medicationDoses } from "@/db/schema";

export async function listMedicationDoses(medicationId: string) {
  const db = getDb();
  return db
    .select()
    .from(medicationDoses)
    .where(
      and(
        eq(medicationDoses.medicationId, medicationId),
        isNull(medicationDoses.deletedAt),
      ),
    )
    .orderBy(desc(medicationDoses.occurredAt));
}

export async function getMedicationDoseById(id: string) {
  const db = getDb();
  const [dose] = await db
    .select()
    .from(medicationDoses)
    .where(and(eq(medicationDoses.id, id), isNull(medicationDoses.deletedAt)))
    .limit(1);
  return dose ?? null;
}

/** 猫の投薬の記録を ID で 1 件読む。別の猫の記録・見つからなければ null */
export async function getMedicationDoseForCat(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<MedicationDose | null> {
  const [record] = await getDb(d1)
    .select()
    .from(medicationDoses)
    .where(
      and(
        eq(medicationDoses.id, id),
        eq(medicationDoses.catId, catId),
        isNull(medicationDoses.deletedAt),
      ),
    )
    .limit(1);
  return record ?? null;
}
