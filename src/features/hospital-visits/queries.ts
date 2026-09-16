import { desc, eq, inArray } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import { type HospitalVisit, hospitalVisits } from "@/db/schema";

export async function listHospitalVisits(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(hospitalVisits)
    .where(eq(hospitalVisits.catId, catId))
    .orderBy(desc(hospitalVisits.visitedAt));
}

export async function getHospitalVisitById(id: string) {
  const db = getDb();
  const [hospitalVisit] = await db
    .select()
    .from(hospitalVisits)
    .where(eq(hospitalVisits.id, id))
    .limit(1);
  return hospitalVisit ?? null;
}

/**
 * 通院記録 ID の一覧から、まとめて通院記録を取得する。
 * 他の記録一覧で関連する通院記録を表示するときに N+1 クエリにならないようにするためのもの
 */
export async function listHospitalVisitsByIds(
  ids: string[],
): Promise<Map<string, HospitalVisit>> {
  const byId = new Map<string, HospitalVisit>();
  if (ids.length === 0) {
    return byId;
  }
  const db = getDb();
  for (const chunk of chunkForBoundParameters(ids)) {
    const rows = await db
      .select()
      .from(hospitalVisits)
      .where(inArray(hospitalVisits.id, chunk));
    for (const row of rows) {
      byId.set(row.id, row);
    }
  }
  return byId;
}
