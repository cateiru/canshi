// @vitest-environment node
import { asc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  cleaningTargets,
  expenseRecords,
  hospitalVisits,
  householdMembers,
  households,
  medicationDoses,
  notifications,
  poopRecords,
  type RecordActor,
  type RecordChangeLogRecordType,
  recordChangeLogs,
  symptoms,
  users,
} from "@/db/schema";
import { createBrushingRecordRepository } from "@/features/brushing-records/infrastructure/brushingRecordRepository";
import { createCatRepository } from "@/features/cats/infrastructure/catRepository";
import { createCleaningRecordRepository } from "@/features/cleaning/infrastructure/cleaningRecordRepository";
import { createCleaningTargetRepository } from "@/features/cleaning/infrastructure/cleaningTargetRepository";
import { createExpenseRecordRepository } from "@/features/expenses/infrastructure/expenseRecordRepository";
import { createFeedingRecordRepository } from "@/features/feeding-records/infrastructure/feedingRecordRepository";
import { createHospitalVisitRepository } from "@/features/hospital-visits/infrastructure/hospitalVisitRepository";
import { createMedicationDoseRepository } from "@/features/medications/infrastructure/medicationDoseRepository";
import { createMedicationRepository } from "@/features/medications/infrastructure/medicationRepository";
import { createMemoRecordRepository } from "@/features/memo-records/infrastructure/memoRecordRepository";
import {
  markCleaningNotificationDone,
  resolveSymptomNotification,
} from "@/features/notifications/application/mutations";
import { createPoopRecordRepository } from "@/features/poop-records/infrastructure/poopRecordRepository";
import { createShampooRecordRepository } from "@/features/shampoo-records/infrastructure/shampooRecordRepository";
import { createSymptomRepository } from "@/features/symptoms/infrastructure/symptomRepository";
import { createVomitRecordRepository } from "@/features/vomit-records/infrastructure/vomitRecordRepository";
import { createWaterRecordRepository } from "@/features/water-records/infrastructure/waterRecordRepository";
import { createWeightRecordRepository } from "@/features/weight-records/infrastructure/weightRecordRepository";

// `getDb` をテスト用の sql.js に差し替える。`user_id` の外部キーも確かめるため、制約を有効にする
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const actor: RecordActor = { userId: "user-1", mcpClientId: null };
const aiActor: RecordActor = { userId: "user-2", mcpClientId: "client-1" };
const at = new Date("2026-07-01T08:00:00Z");

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
  await db.insert(users).values([
    { id: "user-1", name: "ユーザー1" },
    { id: "user-2", name: "ユーザー2" },
  ]);
  await db.insert(households).values({ id: "house", name: "家" });
  await db.insert(householdMembers).values([
    { householdId: "house", userId: "user-1", role: "owner" },
    { householdId: "house", userId: "user-2", role: "member" },
  ]);
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

/** 履歴を古い順に、確かめる列だけで読む */
async function logs() {
  const rows = await db
    .select()
    .from(recordChangeLogs)
    .orderBy(asc(sql`rowid`));
  return rows.map(({ recordType, recordId, action, userId, mcpClientId }) => ({
    recordType,
    recordId,
    action,
    userId,
    mcpClientId,
  }));
}

function log(
  recordType: RecordChangeLogRecordType,
  recordId: string,
  action: "create" | "update" | "delete",
  by: RecordActor = actor,
) {
  return {
    recordType,
    recordId,
    action,
    userId: by.userId,
    mcpClientId: by.mcpClientId,
  };
}

/** 記録の中身は履歴の確認に関係しないため、必須の列だけを持つ値を渡す */
const content = (values: object) => values as never;

describe("猫の記録（同じ形のリポジトリ）", () => {
  const records = [
    {
      recordType: "poop_record",
      repository: createPoopRecordRepository,
      values: { occurredAt: at, consistency: "normal" },
    },
    {
      recordType: "weight_record",
      repository: createWeightRecordRepository,
      values: { occurredAt: at, inputMethod: "direct", catWeightKg: 4 },
    },
    {
      recordType: "vomit_record",
      repository: createVomitRecordRepository,
      values: { occurredAt: at },
    },
    {
      recordType: "water_record",
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
      recordType: "shampoo_record",
      repository: createShampooRecordRepository,
      values: { performedAt: at },
    },
    {
      recordType: "brushing_record",
      repository: createBrushingRecordRepository,
      values: { performedAt: at },
    },
    {
      recordType: "memo_record",
      repository: createMemoRecordRepository,
      values: { content: "メモ" },
    },
  ] as const;

  describe.each(records)(
    "$recordType",
    ({ recordType, repository, values }) => {
      it("作成・編集・削除した人を残す", async () => {
        const repo = repository();
        const id = await repo.add("tama", content(values), actor);
        expect(await repo.update("tama", id, content(values), aiActor)).toBe(
          true,
        );
        expect(await repo.remove("tama", id, actor)).toBe(true);

        expect(await logs()).toEqual([
          log(recordType, id, "create"),
          log(recordType, id, "update", aiActor),
          log(recordType, id, "delete"),
        ]);
      });

      it("書き込みが断られたときは残さない", async () => {
        const repo = repository();
        const id = await repo.add("tama", content(values), actor);
        await db.delete(recordChangeLogs);

        // 別の猫の記録
        expect(await repo.update("kuro", id, content(values), actor)).toBe(
          false,
        );
        expect(await repo.remove("kuro", id, actor)).toBe(false);
        expect(await logs()).toEqual([]);

        // 削除済みの記録
        await repo.remove("tama", id, actor);
        await db.delete(recordChangeLogs);
        expect(await repo.update("tama", id, content(values), actor)).toBe(
          false,
        );
        expect(await repo.remove("tama", id, actor)).toBe(false);
        expect(await logs()).toEqual([]);
      });
    },
  );
});

describe("ごはんの記録", () => {
  const feeding = () => ({
    occurredAt: at,
    mode: "approximate" as const,
    memo: null,
    items: [],
  });

  it("作成・編集・削除した人を残す", async () => {
    const repo = createFeedingRecordRepository();
    const id = await repo.addWhileCatInHousehold(
      "tama",
      "house",
      feeding(),
      false,
      actor,
    );
    if (id == null) throw new Error("追加できなかった");
    expect(
      await repo.updateWhileCatInHousehold(
        "tama",
        "house",
        id,
        feeding(),
        false,
        aiActor,
      ),
    ).toBe(true);
    expect(await repo.remove("tama", id, actor)).toBe(true);

    expect(await logs()).toEqual([
      log("feeding_record", id, "create"),
      log("feeding_record", id, "update", aiActor),
      log("feeding_record", id, "delete"),
    ]);
  });

  it("猫が別の家へ移ったときは残さない", async () => {
    const repo = createFeedingRecordRepository();
    const id = await repo.addWhileCatInHousehold(
      "tama",
      "house",
      feeding(),
      false,
      actor,
    );
    if (id == null) throw new Error("追加できなかった");
    await db.delete(recordChangeLogs);

    expect(
      await repo.addWhileCatInHousehold(
        "tama",
        "other",
        feeding(),
        false,
        actor,
      ),
    ).toBeNull();
    expect(
      await repo.updateWhileCatInHousehold(
        "tama",
        "other",
        id,
        feeding(),
        false,
        actor,
      ),
    ).toBe(false);
    expect(await logs()).toEqual([]);
  });
});

describe("掃除の記録", () => {
  it("作成・編集・削除した人を残す", async () => {
    const repo = createCleaningRecordRepository();
    const values = { performedAt: at, memo: null };
    const id = await repo.add("tama", "target", values, null, actor);
    expect(await repo.update("tama", "target", id, values, null, aiActor)).toBe(
      true,
    );
    expect(await repo.remove("tama", "target", id, actor)).toBe(true);
    // 削除済みなので断られ、残さない
    expect(await repo.remove("tama", "target", id, actor)).toBe(false);

    expect(await logs()).toEqual([
      log("cleaning_record", id, "create"),
      log("cleaning_record", id, "update", aiActor),
      log("cleaning_record", id, "delete"),
    ]);
  });
});

describe("症状の記録", () => {
  const values = (hospitalVisitId: string | null = null) =>
    content({
      symptomType: "くしゃみ",
      onsetAt: at,
      status: "ongoing",
      hospitalVisitId,
    });

  it("作成・編集・削除した人を残す", async () => {
    const repo = createSymptomRepository();
    const id = await repo.add("tama", values(), actor);
    if (id == null) throw new Error("追加できなかった");
    expect(await repo.update("tama", id, values(), aiActor)).toBe(true);
    await repo.remove("tama", id, actor);

    expect(await logs()).toEqual([
      log("symptom", id, "create"),
      log("symptom", id, "update", aiActor),
      log("symptom", id, "delete"),
    ]);
  });

  it("関連する通院記録が削除済みで断られたときは残さない", async () => {
    await db.insert(hospitalVisits).values({
      id: "deleted-visit",
      catId: "tama",
      visitedAt: at,
      reason: "健康診断",
      deletedAt: at,
    });
    const repo = createSymptomRepository();
    expect(await repo.add("tama", values("deleted-visit"), actor)).toBeNull();
    const id = await repo.add("tama", values(), actor);
    if (id == null) throw new Error("追加できなかった");
    await db.delete(recordChangeLogs);

    expect(await repo.update("tama", id, values("deleted-visit"), actor)).toBe(
      false,
    );
    expect(await logs()).toEqual([]);
  });

  it("削除済みの症状をもう一度削除しても残さない", async () => {
    const repo = createSymptomRepository();
    const id = await repo.add("tama", values(), actor);
    if (id == null) throw new Error("追加できなかった");
    await repo.remove("tama", id, actor);
    await db.delete(recordChangeLogs);

    await repo.remove("tama", id, actor);
    expect(await logs()).toEqual([]);
  });
});

describe("服薬予定と投薬実績", () => {
  const values = (symptomId: string | null = null) =>
    content({
      name: "抗生物質",
      doseAmount: "1錠",
      dosesPerDay: 1,
      startDate: "2026-07-01",
      symptomId,
      hospitalVisitId: null,
    });
  const dose = { occurredAt: at, wasAdministered: true, memo: null };

  it("服薬予定の作成・編集・服薬歴への移動・削除した人を残す", async () => {
    const repo = createMedicationRepository();
    const id = await repo.add("tama", values(), actor);
    if (id == null) throw new Error("追加できなかった");
    expect(await repo.update("tama", id, values(), aiActor)).toBe(true);
    await repo.setArchivedAt("tama", id, at, actor);
    await repo.remove("tama", id, aiActor);

    expect(await logs()).toEqual([
      log("medication", id, "create"),
      log("medication", id, "update", aiActor),
      log("medication", id, "update"),
      log("medication", id, "delete", aiActor),
    ]);
  });

  it("関連する症状が削除済みで断られたときは残さない", async () => {
    await db.insert(symptoms).values({
      id: "deleted-symptom",
      catId: "tama",
      symptomType: "くしゃみ",
      onsetAt: at,
      status: "ongoing",
      deletedAt: at,
    });
    const repo = createMedicationRepository();
    expect(await repo.add("tama", values("deleted-symptom"), actor)).toBeNull();
    const id = await repo.add("tama", values(), actor);
    if (id == null) throw new Error("追加できなかった");
    await db.delete(recordChangeLogs);

    expect(
      await repo.update("tama", id, values("deleted-symptom"), actor),
    ).toBe(false);
    expect(await logs()).toEqual([]);
  });

  it("投薬実績の作成・編集・削除した人を残す", async () => {
    const medicationId = await createMedicationRepository().add(
      "tama",
      values(),
      actor,
    );
    if (medicationId == null) throw new Error("追加できなかった");
    await db.delete(recordChangeLogs);

    const repo = createMedicationDoseRepository();
    const id = await repo.add("tama", medicationId, dose, actor);
    if (id == null) throw new Error("追加できなかった");
    expect(await repo.update("tama", medicationId, id, dose, aiActor)).toBe(
      true,
    );
    expect(await repo.remove("tama", medicationId, id, actor)).toBe(true);

    expect(await logs()).toEqual([
      log("medication_dose", id, "create"),
      log("medication_dose", id, "update", aiActor),
      log("medication_dose", id, "delete"),
    ]);
  });

  it("服薬予定が削除済みで断られた投薬実績は残さない", async () => {
    const medications_ = createMedicationRepository();
    const medicationId = await medications_.add("tama", values(), actor);
    if (medicationId == null) throw new Error("追加できなかった");
    await medications_.remove("tama", medicationId, actor);
    await db.delete(recordChangeLogs);

    expect(
      await createMedicationDoseRepository().add(
        "tama",
        medicationId,
        dose,
        actor,
      ),
    ).toBeNull();
    expect(await logs()).toEqual([]);
  });

  it("服薬予定を削除すると、削除されていない投薬実績の分も残す", async () => {
    const repo = createMedicationRepository();
    const medicationId = await repo.add("tama", values(), actor);
    if (medicationId == null) throw new Error("追加できなかった");
    await db.insert(medicationDoses).values([
      {
        id: "live-dose",
        catId: "tama",
        medicationId,
        ...dose,
      },
      {
        id: "deleted-dose",
        catId: "tama",
        medicationId,
        ...dose,
        deletedAt: at,
      },
    ]);
    await db.delete(recordChangeLogs);

    await repo.remove("tama", medicationId, aiActor);

    expect(await logs()).toEqual(
      expect.arrayContaining([
        log("medication_dose", "live-dose", "delete", aiActor),
        log("medication", medicationId, "delete", aiActor),
      ]),
    );
    expect(await logs()).toHaveLength(2);
  });
});

describe("通院記録と病院代の支出", () => {
  const values = (symptomId: string | null = null) =>
    content({ visitedAt: at, reason: "健康診断", symptomId });
  const expense = (amountYen: number | null) => ({
    householdId: "house",
    amountYen,
  });

  async function linkedExpenseId() {
    const [row] = await db
      .select({ id: expenseRecords.id })
      .from(expenseRecords);
    return row.id;
  }

  it("病院代の作成・更新・論理削除も、通院記録を保存した人として残す", async () => {
    const repo = createHospitalVisitRepository();
    const id = await repo.add("tama", values(), expense(1000), actor);
    if (id == null) throw new Error("追加できなかった");
    const expenseId = await linkedExpenseId();
    expect(await logs()).toEqual([
      log("hospital_visit", id, "create"),
      log("expense", expenseId, "create"),
    ]);

    await db.delete(recordChangeLogs);
    expect(
      await repo.update("tama", id, values(), expense(2000), aiActor),
    ).toBe(true);
    expect(await logs()).toEqual([
      log("hospital_visit", id, "update", aiActor),
      log("expense", expenseId, "update", aiActor),
    ]);

    await db.delete(recordChangeLogs);
    expect(await repo.update("tama", id, values(), expense(null), actor)).toBe(
      true,
    );
    expect(await logs()).toEqual([
      log("hospital_visit", id, "update"),
      log("expense", expenseId, "delete"),
    ]);
  });

  it("通院記録の削除では、支出記録を残すため支出の履歴は増えない", async () => {
    const repo = createHospitalVisitRepository();
    const id = await repo.add("tama", values(), expense(1000), actor);
    if (id == null) throw new Error("追加できなかった");
    await db.delete(recordChangeLogs);

    await repo.remove("tama", id, aiActor);
    expect(await logs()).toEqual([
      log("hospital_visit", id, "delete", aiActor),
    ]);
  });

  it("関連する症状が削除済みで断られたときは、通院記録も支出も残さない", async () => {
    await db.insert(symptoms).values({
      id: "deleted-symptom",
      catId: "tama",
      symptomType: "くしゃみ",
      onsetAt: at,
      status: "ongoing",
      deletedAt: at,
    });
    const repo = createHospitalVisitRepository();
    expect(
      await repo.add("tama", values("deleted-symptom"), expense(1000), actor),
    ).toBeNull();
    expect(await logs()).toEqual([]);

    const id = await repo.add("tama", values(), expense(1000), actor);
    if (id == null) throw new Error("追加できなかった");
    await db.delete(recordChangeLogs);
    expect(
      await repo.update(
        "tama",
        id,
        values("deleted-symptom"),
        expense(2000),
        actor,
      ),
    ).toBe(false);
    expect(await logs()).toEqual([]);
  });

  it("削除済みの通院記録の更新は、通院記録も支出も残さない", async () => {
    const repo = createHospitalVisitRepository();
    const id = await repo.add("tama", values(), expense(1000), actor);
    if (id == null) throw new Error("追加できなかった");
    await repo.remove("tama", id, actor);
    await db.delete(recordChangeLogs);

    expect(await repo.update("tama", id, values(), expense(2000), actor)).toBe(
      false,
    );
    expect(await logs()).toEqual([]);
  });
});

describe("支出記録", () => {
  const values = {
    spentAt: at,
    amountYen: 1000,
    category: "food" as const,
    memo: null,
  };
  const links = { catIds: ["tama"], hospitalVisitIds: [] };

  it("作成・編集・削除した人を残す", async () => {
    const repo = createExpenseRecordRepository();
    const id = await repo.add("house", values, links, actor);
    await repo.update("house", id, values, links, aiActor);
    await repo.remove(id, actor);

    expect(await logs()).toEqual([
      log("expense", id, "create"),
      log("expense", id, "update", aiActor),
      log("expense", id, "delete"),
    ]);
  });

  it("別の家の更新・削除済みの更新と削除では残さない", async () => {
    const repo = createExpenseRecordRepository();
    const id = await repo.add("house", values, links, actor);
    await db.delete(recordChangeLogs);

    await repo.update("other", id, values, links, actor);
    expect(await logs()).toEqual([]);

    await repo.remove(id, actor);
    await db.delete(recordChangeLogs);
    await repo.update("house", id, values, links, actor);
    await repo.remove(id, actor);
    expect(await logs()).toEqual([]);
  });
});

describe("通知からの操作", () => {
  it("掃除の通知を完了にすると、追加した記録の作成者を残す。完了済みなら残さない", async () => {
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

    expect(
      await markCleaningNotificationDone("user-1", "cleaning-notification"),
    ).toBe("done");
    const [log1, ...rest] = await logs();
    expect(rest).toEqual([]);
    expect(log1).toMatchObject({
      recordType: "cleaning_record",
      action: "create",
      userId: "user-1",
      mcpClientId: null,
    });

    await markCleaningNotificationDone("user-1", "cleaning-notification");
    expect(await logs()).toHaveLength(1);
  });

  it("症状の通知で解消にすると、編集者を残す。解消済みの症状では残さない", async () => {
    await db.insert(symptoms).values({
      id: "symptom",
      catId: "tama",
      symptomType: "くしゃみ",
      onsetAt: at,
      status: "ongoing",
    });
    await db.insert(notifications).values({
      id: "symptom-notification",
      catId: "tama",
      kind: "symptom_ongoing",
      referenceId: "symptom",
      dedupeKey: "symptom",
      url: "/notifications",
      title: "症状",
      body: "症状はどうですか",
      dueAt: at,
    });

    await resolveSymptomNotification("user-1", "symptom-notification");
    expect(await logs()).toEqual([log("symptom", "symptom", "update")]);

    await resolveSymptomNotification("user-1", "symptom-notification");
    expect(await logs()).toHaveLength(1);
  });
});

describe("物理削除", () => {
  it("猫を削除すると、その猫の記録の履歴も消す。支出の履歴は残す", async () => {
    const poop = createPoopRecordRepository();
    const tamaRecord = await poop.add(
      "tama",
      content({ occurredAt: at, consistency: "normal" }),
      actor,
    );
    const kuroRecord = await poop.add(
      "kuro",
      content({ occurredAt: at, consistency: "normal" }),
      actor,
    );
    const symptom = await createSymptomRepository().add(
      "tama",
      content({ symptomType: "くしゃみ", onsetAt: at, status: "ongoing" }),
      actor,
    );
    const expense = await createExpenseRecordRepository().add(
      "house",
      { spentAt: at, amountYen: 1000, category: "food", memo: null },
      { catIds: ["tama"], hospitalVisitIds: [] },
      actor,
    );
    expect(symptom).not.toBeNull();

    await createCatRepository().removeForUser("user-1", "tama");

    expect(await logs()).toEqual(
      expect.arrayContaining([
        log("poop_record", kuroRecord, "create"),
        log("expense", expense, "create"),
      ]),
    );
    expect(await logs()).toHaveLength(2);
    expect(
      await db.select().from(poopRecords).where(eq(poopRecords.id, tamaRecord)),
    ).toEqual([]);
  });

  it("掃除対象を削除すると、その実施記録の履歴も消す", async () => {
    await db.insert(cleaningTargets).values({
      id: "other-target",
      catId: "tama",
      name: "水飲み場",
      frequencyValue: 1,
      frequencyUnit: "days",
    });
    const repo = createCleaningRecordRepository();
    const values = { performedAt: at, memo: null };
    await repo.add("tama", "target", values, null, actor);
    const otherId = await repo.add("tama", "other-target", values, null, actor);

    await createCleaningTargetRepository().remove("tama", "target");

    expect(await logs()).toEqual([log("cleaning_record", otherId, "create")]);
  });
});

describe("外部キー", () => {
  it("存在しないユーザーの履歴は保存できず、ユーザーの物理削除も防ぐ", async () => {
    await expect(
      createPoopRecordRepository().add(
        "tama",
        content({ occurredAt: at, consistency: "normal" }),
        { userId: "unknown", mcpClientId: null },
      ),
    ).rejects.toThrow();

    await createPoopRecordRepository().add(
      "tama",
      content({ occurredAt: at, consistency: "normal" }),
      actor,
    );
    await db
      .delete(householdMembers)
      .where(eq(householdMembers.userId, "user-1"));
    await expect(
      db.delete(users).where(eq(users.id, "user-1")),
    ).rejects.toThrow();
  });
});
