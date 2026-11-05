// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  expenseRecords,
  hospitalVisits,
  households,
  medicationDoses,
  medications,
  symptoms,
} from "@/db/schema";
import { listTimelineForMonth } from "@/features/timeline/infrastructure/queries";
import { listMedicationDoses } from "../infrastructure/doseQueries";
import {
  listMedications,
  listMedicationsByHospitalVisitIds,
} from "../infrastructure/queries";
import {
  createMedicationDose,
  deleteMedicationDose,
  updateMedicationDose,
} from "./doseMutations";
import { deleteMedication, updateMedication } from "./mutations";

// `src/features/households/application/management.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
  // sql.js は `db.batch`（D1 専用）を持たないため、順番に実行するだけの簡易実装で補う
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に D1 の batch を簡易実装する
  (db as any).batch = async (statements: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement);
    }
    return results;
  };
  await db.insert(cats).values([
    { id: "tama", name: "たま", sex: "female" },
    { id: "kuro", name: "くろ", sex: "male" },
  ]);
  await db.insert(medications).values([
    {
      id: "med",
      catId: "tama",
      name: "抗生物質",
      doseAmount: "1錠",
      dosesPerDay: 2,
      startDate: "2026-07-01",
    },
    {
      id: "other-med",
      catId: "tama",
      name: "目薬",
      doseAmount: "1滴",
      dosesPerDay: 1,
      startDate: "2026-07-01",
    },
  ]);
  await db.insert(medicationDoses).values([
    {
      id: "dose-1",
      catId: "tama",
      medicationId: "med",
      occurredAt: new Date("2026-07-02T08:00:00Z"),
    },
    {
      id: "dose-2",
      catId: "tama",
      medicationId: "med",
      occurredAt: new Date("2026-07-02T20:00:00Z"),
    },
    {
      id: "other-dose",
      catId: "tama",
      medicationId: "other-med",
      occurredAt: new Date("2026-07-03T08:00:00Z"),
    },
  ]);
});

const medicationForm = {
  name: "抗生物質（変更）",
  doseAmount: "1錠",
  dosesPerDay: 2,
  startDate: "2026-07-01",
};

const doseForm = {
  occurredDate: "2026-07-04",
  occurredTime: "08:00",
  wasAdministered: true,
};

async function findDeletedAt(id: string) {
  const [row] = await db
    .select({ deletedAt: medicationDoses.deletedAt })
    .from(medicationDoses)
    .where(eq(medicationDoses.id, id));
  return row.deletedAt;
}

describe("deleteMedication", () => {
  it("服薬予定と投薬実績を論理削除し、一覧・タイムラインから除く", async () => {
    expect(await deleteMedication("tama", "med")).toBe(true);

    expect((await listMedications("tama")).map((row) => row.id)).toEqual([
      "other-med",
    ]);
    expect(await listMedicationDoses("med")).toEqual([]);
    const timeline = await listTimelineForMonth("tama", 2026, 7);
    expect(timeline.entries.map((entry) => entry.id)).toEqual(["other-dose"]);

    // 行は残し、服薬予定と投薬実績に同じ削除日時を入れる
    const [medication] = await db
      .select({ deletedAt: medications.deletedAt })
      .from(medications)
      .where(eq(medications.id, "med"));
    expect(medication.deletedAt).toBeInstanceOf(Date);
    expect(await findDeletedAt("dose-1")).toEqual(medication.deletedAt);
    expect(await findDeletedAt("dose-2")).toEqual(medication.deletedAt);
    expect(await findDeletedAt("other-dose")).toBeNull();
  });

  it("通院記録に紐付いた処方薬の一覧からも除く", async () => {
    await db.insert(hospitalVisits).values({
      id: "visit",
      catId: "tama",
      visitedAt: new Date("2026-07-01T10:00:00Z"),
      reason: "皮膚炎",
    });
    await db
      .update(medications)
      .set({ hospitalVisitId: "visit" })
      .where(eq(medications.catId, "tama"));

    await deleteMedication("tama", "med");

    const byVisitId = await listMedicationsByHospitalVisitIds("tama", [
      "visit",
    ]);
    expect(byVisitId.get("visit")?.map((row) => row.id)).toEqual(["other-med"]);
  });

  it("削除済みの服薬予定は、更新・もう一度の削除・投薬実績の追加ができない", async () => {
    await deleteMedication("tama", "med");

    expect(await deleteMedication("tama", "med")).toBe(false);
    expect(await updateMedication("tama", "med", medicationForm)).toBeNull();
    expect(await createMedicationDose("tama", "med", doseForm)).toBeNull();
  });

  it("別の猫の服薬予定は削除しない", async () => {
    expect(await deleteMedication("kuro", "med")).toBe(false);
    expect(await findDeletedAt("dose-1")).toBeNull();
  });
});

describe("createMedicationDose", () => {
  it("服薬予定に投薬実績を追加する", async () => {
    const id = await createMedicationDose("tama", "med", {
      ...doseForm,
      wasAdministered: false,
      memo: "吐き出した",
    });

    const [row] = await db
      .select()
      .from(medicationDoses)
      .where(eq(medicationDoses.id, id as string));
    expect(row).toMatchObject({
      catId: "tama",
      medicationId: "med",
      occurredAt: new Date("2026-07-04T08:00:00.000Z"),
      wasAdministered: false,
      memo: "吐き出した",
      deletedAt: null,
    });
  });

  it("別の猫の服薬予定や、確認の後に論理削除された服薬予定には追加しない", async () => {
    await db
      .update(medications)
      .set({ deletedAt: new Date() })
      .where(eq(medications.id, "med"));
    const { createMedicationDoseRepository } = await import(
      "../infrastructure/medicationDoseRepository"
    );
    const content = {
      occurredAt: new Date("2026-07-04T08:00:00.000Z"),
      wasAdministered: true,
      memo: null,
    };

    expect(
      await createMedicationDoseRepository().add("tama", "med", content),
    ).toBeNull();
    expect(
      await createMedicationDoseRepository().add("kuro", "other-med", content),
    ).toBeNull();
    expect(await db.select().from(medicationDoses)).toHaveLength(3);
  });
});

describe("deleteMedicationDose", () => {
  it("投薬実績を論理削除し、削除済みの実績は更新・もう一度の削除ができない", async () => {
    expect(await deleteMedicationDose("tama", "med", "dose-1")).toBe(true);

    expect(await findDeletedAt("dose-1")).toBeInstanceOf(Date);
    expect((await listMedicationDoses("med")).map((row) => row.id)).toEqual([
      "dose-2",
    ]);
    expect(await deleteMedicationDose("tama", "med", "dose-1")).toBe(false);
    expect(await updateMedicationDose("tama", "med", "dose-1", doseForm)).toBe(
      false,
    );
  });
});

describe("確認の後に関連する記録が論理削除された場合", () => {
  const deletedAt = new Date("2026-07-05T00:00:00Z");

  beforeEach(async () => {
    await db.insert(symptoms).values([
      {
        id: "deleted-symptom",
        catId: "tama",
        symptomType: "vomit",
        onsetAt: new Date("2026-07-01T00:00:00Z"),
        status: "ongoing",
        deletedAt,
      },
      {
        id: "live-symptom",
        catId: "tama",
        symptomType: "vomit",
        onsetAt: new Date("2026-07-01T00:00:00Z"),
        status: "ongoing",
      },
    ]);
    await db.insert(hospitalVisits).values({
      id: "deleted-visit",
      catId: "tama",
      visitedAt: new Date("2026-07-01T10:00:00Z"),
      reason: "健診",
      deletedAt,
    });
  });

  const medicationContent = {
    name: "抗生物質",
    doseAmount: "1錠",
    dosesPerDay: 2,
    startDate: "2026-07-01",
    endDate: null,
    symptomId: null,
    hospitalVisitId: null,
  };
  const visitContent = {
    symptomId: null,
    visitedAt: new Date("2026-07-02T10:00:00Z"),
    reason: "再診",
    diagnosis: null,
    examinationResults: null,
    treatment: null,
    nextVisitAt: null,
    memo: null,
  };
  const symptomContent = {
    symptomType: "vomit" as const,
    onsetAt: new Date("2026-07-02T00:00:00Z"),
    frequencyOrSeverity: null,
    appetiteNote: null,
    energyNote: null,
    status: "ongoing" as const,
    hospitalVisitId: null,
    memo: null,
  };

  it("服薬予定は、削除済みの症状・通院記録を参照して追加・更新しない", async () => {
    const { createMedicationRepository } = await import(
      "../infrastructure/medicationRepository"
    );
    const repository = createMedicationRepository();

    expect(
      await repository.add("tama", {
        ...medicationContent,
        symptomId: "deleted-symptom",
      }),
    ).toBeNull();
    expect(
      await repository.add("tama", {
        ...medicationContent,
        hospitalVisitId: "deleted-visit",
      }),
    ).toBeNull();
    // 別の猫の症状も参照しない
    expect(
      await repository.add("kuro", {
        ...medicationContent,
        symptomId: "live-symptom",
      }),
    ).toBeNull();
    expect(
      await repository.update("tama", "med", {
        ...medicationContent,
        symptomId: "deleted-symptom",
      }),
    ).toBe(false);
    expect(await db.select().from(medications)).toHaveLength(2);
    const [med] = await db
      .select({ name: medications.name, symptomId: medications.symptomId })
      .from(medications)
      .where(eq(medications.id, "med"));
    expect(med).toEqual({ name: "抗生物質", symptomId: null });

    // 削除されていない症状なら、既定値（ID・作成日時など）を入れて追加できる
    const id = await repository.add("tama", {
      ...medicationContent,
      symptomId: "live-symptom",
    });
    const [created] = await db
      .select()
      .from(medications)
      .where(eq(medications.id, id as string));
    expect(created).toMatchObject({
      catId: "tama",
      symptomId: "live-symptom",
      archivedAt: null,
      deletedAt: null,
    });
    expect(created.createdAt).toBeInstanceOf(Date);
  });

  it("症状は、削除済みの通院記録を参照して追加・更新しない", async () => {
    const { createSymptomRepository } = await import(
      "@/features/symptoms/infrastructure/symptomRepository"
    );
    const repository = createSymptomRepository();

    expect(
      await repository.add("tama", {
        ...symptomContent,
        hospitalVisitId: "deleted-visit",
      }),
    ).toBeNull();
    expect(
      await repository.update("tama", "live-symptom", {
        ...symptomContent,
        hospitalVisitId: "deleted-visit",
      }),
    ).toBe(false);
    expect(await db.select().from(symptoms)).toHaveLength(2);
  });

  it("通院記録は、削除済みの症状を参照して追加・更新せず、病院代の支出も作らない", async () => {
    const { createHospitalVisitRepository } = await import(
      "@/features/hospital-visits/infrastructure/hospitalVisitRepository"
    );
    const repository = createHospitalVisitRepository();
    await db.insert(households).values({ id: "home", name: "わが家" });
    await db.insert(hospitalVisits).values({
      id: "live-visit",
      catId: "tama",
      visitedAt: new Date("2026-07-01T10:00:00Z"),
      reason: "健診",
    });

    expect(
      await repository.add(
        "tama",
        { ...visitContent, symptomId: "deleted-symptom" },
        { householdId: "home", amountYen: 3000 },
      ),
    ).toBeNull();
    expect(
      await repository.update(
        "tama",
        "live-visit",
        { ...visitContent, symptomId: "deleted-symptom" },
        { householdId: "home", amountYen: 3000 },
      ),
    ).toBe(false);
    expect(await db.select().from(hospitalVisits)).toHaveLength(2);
    expect(await db.select().from(expenseRecords)).toEqual([]);

    // 削除されていない症状なら追加でき、病院代の支出も作る
    expect(
      await repository.add(
        "tama",
        { ...visitContent, symptomId: "live-symptom" },
        { householdId: "home", amountYen: 3000 },
      ),
    ).toEqual(expect.any(String));
    expect(await db.select().from(expenseRecords)).toHaveLength(1);
  });
});
