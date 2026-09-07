import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type Medication, medications } from "@/db/schema";

export async function listMedications(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(medications)
    .where(eq(medications.catId, catId))
    .orderBy(desc(medications.startDate));
}

/**
 * 通院記録一覧など、複数の通院記録に紐づく処方薬をまとめて取得する際に、
 * 訪問件数ぶんクエリを発行する N+1 を避けるための一括取得。
 */
export async function listMedicationsByHospitalVisitIds(
  catId: string,
  hospitalVisitIds: string[],
): Promise<Map<string, Medication[]>> {
  const byVisitId = new Map<string, Medication[]>();
  if (hospitalVisitIds.length === 0) {
    return byVisitId;
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(medications)
    .where(
      and(
        eq(medications.catId, catId),
        inArray(medications.hospitalVisitId, hospitalVisitIds),
      ),
    )
    .orderBy(desc(medications.startDate));

  for (const medication of rows) {
    if (medication.hospitalVisitId == null) {
      continue;
    }
    const list = byVisitId.get(medication.hospitalVisitId) ?? [];
    list.push(medication);
    byVisitId.set(medication.hospitalVisitId, list);
  }

  return byVisitId;
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
