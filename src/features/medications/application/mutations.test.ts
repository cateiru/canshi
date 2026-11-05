// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  hospitalVisits,
  medicationDoses,
  medications,
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
