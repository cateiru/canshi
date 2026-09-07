// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";
import { cats } from "./cats";
import { medicationDoses } from "./medication-doses";
import { medications } from "./medications";
import { symptoms } from "./symptoms";

describe("medications / medication_doses テーブル", () => {
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    const SQL = await initSqlJs();
    const sqlite = new SQL.Database();
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  it("症状への参照つきで服薬予定を insert / select できる", async () => {
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

    const [medication] = await db
      .insert(medications)
      .values({
        catId: cat.id,
        symptomId: symptom.id,
        name: "抗生剤",
        doseAmount: "1錠",
        dosesPerDay: 2,
        startDate: "2026-09-01",
      })
      .returning();

    expect(medication.symptomId).toBe(symptom.id);

    await db.insert(medicationDoses).values({
      catId: cat.id,
      medicationId: medication.id,
      occurredAt: new Date("2026-09-01T08:00:00.000Z"),
      wasAdministered: true,
    });

    const doseRows = await db.select().from(medicationDoses);
    expect(doseRows).toHaveLength(1);
    expect(doseRows[0].medicationId).toBe(medication.id);
    expect(doseRows[0].catId).toBe(cat.id);
    expect(doseRows[0].wasAdministered).toBe(true);
  });
});
