// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  cleaningRecords,
  cleaningTargets,
  expenseRecordHospitalVisits,
  expenseRecords,
  feedingRecords,
  hospitalVisits,
  householdMembers,
  households,
  medicationDoses,
  medications,
  notifications,
  type RecordActor,
  recordChangeLogs,
  symptoms,
  users,
} from "@/db/schema";
import { createBrushingRecordRepository } from "@/features/brushing-records/infrastructure/brushingRecordRepository";
import { createCleaningRecordRepository } from "@/features/cleaning/infrastructure/cleaningRecordRepository";
import { createCleaningTargetRepository } from "@/features/cleaning/infrastructure/cleaningTargetRepository";
import { createFeedingRecordRepository } from "@/features/feeding-records/infrastructure/feedingRecordRepository";
import { createHospitalVisitRepository } from "@/features/hospital-visits/infrastructure/hospitalVisitRepository";
import { createMedicationDoseRepository } from "@/features/medications/infrastructure/medicationDoseRepository";
import { createMedicationRepository } from "@/features/medications/infrastructure/medicationRepository";
import { createMemoRecordRepository } from "@/features/memo-records/infrastructure/memoRecordRepository";
import { createPoopRecordRepository } from "@/features/poop-records/infrastructure/poopRecordRepository";
import { createShampooRecordRepository } from "@/features/shampoo-records/infrastructure/shampooRecordRepository";
import { createSymptomRepository } from "@/features/symptoms/infrastructure/symptomRepository";
import { createVomitRecordRepository } from "@/features/vomit-records/infrastructure/vomitRecordRepository";
import { createWaterRecordRepository } from "@/features/water-records/infrastructure/waterRecordRepository";
import { createWeightRecordRepository } from "@/features/weight-records/infrastructure/weightRecordRepository";

/*
 * 画面・MCP で書き込める猫か確かめた後、書き込みの前に猫がメモリーへ移された場合（#576）に、
 * 記録のリポジトリの文の中で書き込みが断られることを確かめる。
 * テストでは、記録を用意した後に猫の `memorial_date` を直接入れて、確認の後にメモリーへ移された状態を作る
 */

let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const actor: RecordActor = {
  userId: "user-1",
  mcpClientId: null,
  apiTokenId: null,
};
const at = new Date("2026-07-01T08:00:00Z");
const later = new Date("2026-07-02T08:00:00Z");

beforeEach(async () => {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  sqlite.run("PRAGMA foreign_keys = ON");
  db = drizzle(sqlite) as unknown as ReturnType<typeof getDb>;
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
  await db.insert(users).values({ id: "user-1", name: "ユーザー1" });
  await db.insert(households).values({ id: "house", name: "家" });
  await db
    .insert(householdMembers)
    .values({ householdId: "house", userId: "user-1", role: "owner" });
  await db.insert(cats).values([
    { id: "tama", name: "たま", sex: "female", householdId: "house" },
    { id: "kuro", name: "くろ", sex: "male", householdId: "house" },
  ]);
  await db.insert(cleaningTargets).values({
    id: "target",
    catId: "tama",
    name: "トイレ",
    frequencyValue: 1,
    frequencyUnit: "days",
  });
});

/** 確認の後に、別の家族が猫をメモリーへ移したことにする */
async function memorialize(catId: string) {
  await db
    .update(cats)
    .set({ memorialDate: "2026-07-01" })
    .where(eq(cats.id, catId));
  // 用意した記録の履歴は確かめないため消す
  await db.delete(recordChangeLogs);
}

async function restoreFromMemorial(catId: string) {
  await db.update(cats).set({ memorialDate: null }).where(eq(cats.id, catId));
}

function required<T>(value: T | null): T {
  if (value == null) throw new Error("追加できなかった");
  return value;
}

/** 記録の中身は書き込めるかに関係しないため、必須の列だけを持つ値を渡す */
const content = (values: object) => values as never;

describe("同じ形の記録のリポジトリ", () => {
  const records = [
    {
      name: "うんち",
      repository: createPoopRecordRepository,
      values: { occurredAt: at, consistency: "normal" },
    },
    {
      name: "体重",
      repository: createWeightRecordRepository,
      values: { occurredAt: at, inputMethod: "direct", catWeightKg: 4 },
    },
    {
      name: "嘔吐",
      repository: createVomitRecordRepository,
      values: { occurredAt: at },
    },
    {
      name: "飲水",
      repository: createWaterRecordRepository,
      values: {
        occurredAt: at,
        measurementMethod: "direct",
        suppliedAmountMl: 100,
        remainingAmountMl: 50,
        estimatedIntakeMl: 50,
      },
    },
    {
      name: "シャンプー",
      repository: createShampooRecordRepository,
      values: { performedAt: at },
    },
    {
      name: "ブラッシング",
      repository: createBrushingRecordRepository,
      values: { performedAt: at },
    },
    {
      name: "メモ",
      repository: createMemoRecordRepository,
      values: { content: "メモ", labelIds: [] },
    },
  ] as const;

  describe.each(records)("$name", ({ repository, values }) => {
    it("メモリーへ移した猫の記録は、追加・編集・削除できず、履歴も残さない", async () => {
      const repo = repository();
      const id = required(await repo.add("tama", content(values), actor));
      await memorialize("tama");

      expect(await repo.add("tama", content(values), actor)).toBeNull();
      expect(await repo.update("tama", id, content(values), actor)).toBe(false);
      expect(await repo.remove("tama", id, actor)).toBe(false);
      expect(await db.select().from(recordChangeLogs)).toEqual([]);

      // ほかの猫の記録には影響しない
      const kuroId = required(await repo.add("kuro", content(values), actor));
      expect(await repo.remove("kuro", kuroId, actor)).toBe(true);
    });

    it("メモリーから戻すと、また書き込める", async () => {
      const repo = repository();
      const id = required(await repo.add("tama", content(values), actor));
      await memorialize("tama");
      await restoreFromMemorial("tama");

      expect(await repo.add("tama", content(values), actor)).not.toBeNull();
      expect(await repo.update("tama", id, content(values), actor)).toBe(true);
      expect(await repo.remove("tama", id, actor)).toBe(true);
    });
  });
});

describe("症状の記録", () => {
  const values = content({
    symptomType: "くしゃみ",
    onsetAt: at,
    status: "ongoing",
    hospitalVisitId: null,
  });

  it("追加・編集・削除できず、削除に伴う紐付けの解除・通知の削除もしない", async () => {
    const repo = createSymptomRepository();
    const id = required(await repo.add("tama", values, actor));
    await db.insert(medications).values({
      id: "medication",
      catId: "tama",
      name: "抗生物質",
      doseAmount: "1錠",
      dosesPerDay: 1,
      startDate: "2026-07-01",
      symptomId: id,
    });
    await db.insert(notifications).values({
      id: "symptom-notification",
      catId: "tama",
      kind: "symptom_ongoing",
      referenceId: id,
      dedupeKey: "symptom",
      url: "/notifications",
      title: "症状",
      body: "症状は続いていますか",
      dueAt: at,
    });
    await memorialize("tama");

    expect(await repo.add("tama", values, actor)).toBeNull();
    expect(await repo.update("tama", id, values, actor)).toBe(false);
    expect(await repo.remove("tama", id, actor)).toBe(false);

    const [symptom] = await db
      .select({ deletedAt: symptoms.deletedAt })
      .from(symptoms)
      .where(eq(symptoms.id, id));
    expect(symptom.deletedAt).toBeNull();
    const [medication] = await db
      .select({ symptomId: medications.symptomId })
      .from(medications);
    expect(medication.symptomId).toBe(id);
    expect(await db.select().from(notifications)).toHaveLength(1);
    expect(await db.select().from(recordChangeLogs)).toEqual([]);
  });
});

describe("服薬予定と投薬実績", () => {
  const values = content({
    name: "抗生物質",
    doseAmount: "1錠",
    dosesPerDay: 1,
    startDate: "2026-07-01",
    symptomId: null,
    hospitalVisitId: null,
  });
  const dose = { occurredAt: at, wasAdministered: true, memo: null };

  it("服薬予定は追加・編集・服薬歴への移動・削除ができず、投薬実績も消さない", async () => {
    const repo = createMedicationRepository();
    const id = required(await repo.add("tama", values, actor));
    const doseId = required(
      await createMedicationDoseRepository().add("tama", id, dose, actor),
    );
    await memorialize("tama");

    expect(await repo.add("tama", values, actor)).toBeNull();
    expect(await repo.update("tama", id, values, actor)).toBe(false);
    await repo.setArchivedAt("tama", id, later, actor);
    expect(await repo.remove("tama", id, actor)).toBe(false);

    const [medication] = await db
      .select({
        archivedAt: medications.archivedAt,
        deletedAt: medications.deletedAt,
      })
      .from(medications)
      .where(eq(medications.id, id));
    expect(medication).toEqual({ archivedAt: null, deletedAt: null });
    const [doseRow] = await db
      .select({ deletedAt: medicationDoses.deletedAt })
      .from(medicationDoses)
      .where(eq(medicationDoses.id, doseId));
    expect(doseRow.deletedAt).toBeNull();
    expect(await db.select().from(recordChangeLogs)).toEqual([]);
  });

  it("投薬実績は追加・編集・削除できない", async () => {
    const medicationId = required(
      await createMedicationRepository().add("tama", values, actor),
    );
    const repo = createMedicationDoseRepository();
    const id = required(await repo.add("tama", medicationId, dose, actor));
    await memorialize("tama");

    expect(await repo.add("tama", medicationId, dose, actor)).toBeNull();
    expect(await repo.update("tama", medicationId, id, dose, actor)).toBe(
      false,
    );
    expect(await repo.remove("tama", medicationId, id, actor)).toBe(false);
    expect(await db.select().from(medicationDoses)).toHaveLength(1);
    expect(await db.select().from(recordChangeLogs)).toEqual([]);
  });
});

describe("通院記録と病院代の支出", () => {
  const values = content({
    visitedAt: at,
    reason: "健康診断",
    symptomId: null,
  });
  const expense = (amountYen: number | null) => ({
    householdId: "house",
    amountYen,
  });

  it("追加・編集・削除できず、病院代の支出も作成・変更しない", async () => {
    const repo = createHospitalVisitRepository();
    const id = required(await repo.add("tama", values, expense(1000), actor));
    await memorialize("tama");

    expect(await repo.add("tama", values, expense(500), actor)).toBeNull();
    expect(await repo.update("tama", id, values, expense(2000), actor)).toBe(
      false,
    );
    expect(await repo.update("tama", id, values, expense(null), actor)).toBe(
      false,
    );
    expect(await repo.remove("tama", id, actor)).toBe(false);

    expect(await db.select().from(hospitalVisits)).toHaveLength(1);
    const expenses = await db
      .select({
        amountYen: expenseRecords.amountYen,
        deletedAt: expenseRecords.deletedAt,
      })
      .from(expenseRecords);
    expect(expenses).toEqual([{ amountYen: 1000, deletedAt: null }]);
    expect(await db.select().from(expenseRecordHospitalVisits)).toHaveLength(1);
    expect(await db.select().from(recordChangeLogs)).toEqual([]);
  });
});

describe("ごはんの記録", () => {
  const feeding = () => ({
    occurredAt: at,
    mode: "approximate" as const,
    memo: null,
    items: [],
  });

  it("追加・編集・削除できない", async () => {
    const repo = createFeedingRecordRepository();
    const id = required(
      await repo.addWhileCatInHousehold(
        "tama",
        "house",
        feeding(),
        false,
        actor,
      ),
    );
    await memorialize("tama");

    expect(
      await repo.addWhileCatInHousehold(
        "tama",
        "house",
        feeding(),
        false,
        actor,
      ),
    ).toBeNull();
    expect(
      await repo.updateWhileCatInHousehold(
        "tama",
        "house",
        id,
        feeding(),
        false,
        actor,
      ),
    ).toBe(false);
    expect(await repo.remove("tama", id, actor)).toBe(false);

    const rows = await db
      .select({ deletedAt: feedingRecords.deletedAt })
      .from(feedingRecords);
    expect(rows).toEqual([{ deletedAt: null }]);
    expect(await db.select().from(recordChangeLogs)).toEqual([]);
  });
});

describe("掃除の実施記録と掃除対象", () => {
  const values = { performedAt: at, memo: null };

  it("実施記録は追加・編集・削除できず、掃除の通知も完了にしない", async () => {
    const repo = createCleaningRecordRepository();
    const id = required(await repo.add("tama", "target", values, null, actor));
    await db.insert(notifications).values({
      id: "cleaning-notification",
      catId: "tama",
      kind: "cleaning_due",
      referenceId: "target",
      dedupeKey: "cleaning",
      url: "/notifications",
      title: "掃除",
      body: "掃除の時間です",
      dueAt: at,
    });
    await memorialize("tama");

    expect(await repo.add("tama", "target", values, later, actor)).toBeNull();
    expect(await repo.update("tama", "target", id, values, later, actor)).toBe(
      false,
    );
    expect(await repo.remove("tama", "target", id, actor)).toBe(false);

    const [notification] = await db
      .select({ status: notifications.status })
      .from(notifications);
    expect(notification.status).toBe("pending");
    expect(await db.select().from(cleaningRecords)).toHaveLength(1);
    expect(await db.select().from(recordChangeLogs)).toEqual([]);
  });

  it("掃除対象は追加・編集・削除できず、実施記録も消さない", async () => {
    required(
      await createCleaningRecordRepository().add(
        "tama",
        "target",
        values,
        null,
        actor,
      ),
    );
    const repo = createCleaningTargetRepository();
    const target = {
      name: "水飲み場",
      frequencyValue: 2,
      frequencyUnit: "days" as const,
      isActive: true,
      notifyTime: null,
    };
    await memorialize("tama");

    await repo.add("tama", target);
    expect(await repo.update("tama", "target", target)).toBe(false);
    await repo.remove("tama", "target");

    const targets = await db
      .select({ name: cleaningTargets.name })
      .from(cleaningTargets);
    expect(targets).toEqual([{ name: "トイレ" }]);
    expect(await db.select().from(cleaningRecords)).toHaveLength(1);

    // メモリーへ移していない猫には追加できる
    await repo.add("kuro", target);
    expect(await db.select().from(cleaningTargets)).toHaveLength(2);
  });
});
