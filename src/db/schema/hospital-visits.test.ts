// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { hospitalVisits } from "./hospital-visits";
import { medications } from "./medications";
import { symptoms } from "./symptoms";

describe("hospital_visits テーブル（symptoms・medications との相互参照）", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("症状・服薬から通院記録への外部キー、通院記録から症状への外部キーが両方使える", async () => {
    const [cat] = await db
      .insert(cats)
      .values({ name: "たま", sex: "female" })
      .returning();
    const [symptom] = await db
      .insert(symptoms)
      .values({
        catId: cat.id,
        symptomType: "嘔吐",
        onsetAt: new Date("2026-09-01T00:00:00.000Z"),
        status: "ongoing",
      })
      .returning();

    const [visit] = await db
      .insert(hospitalVisits)
      .values({
        catId: cat.id,
        symptomId: symptom.id,
        visitedAt: new Date("2026-09-02T10:00:00.000Z"),
        reason: "嘔吐が続くため",
      })
      .returning();

    expect(visit.symptomId).toBe(symptom.id);

    await db
      .update(symptoms)
      .set({ hospitalVisitId: visit.id })
      .where(eq(symptoms.id, symptom.id));

    const [medication] = await db
      .insert(medications)
      .values({
        catId: cat.id,
        symptomId: symptom.id,
        hospitalVisitId: visit.id,
        name: "制吐剤",
        doseAmount: "1錠",
        dosesPerDay: 1,
        startDate: "2026-09-02",
      })
      .returning();

    expect(medication.hospitalVisitId).toBe(visit.id);

    const [updatedSymptom] = await db
      .select()
      .from(symptoms)
      .where(eq(symptoms.id, symptom.id));
    expect(updatedSymptom.hospitalVisitId).toBe(visit.id);
  });
});
