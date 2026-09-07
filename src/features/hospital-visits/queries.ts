import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { hospitalVisits } from "@/db/schema";

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
