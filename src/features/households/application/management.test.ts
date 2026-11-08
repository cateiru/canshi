// @vitest-environment node
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  expenseRecordCats,
  expenseRecords,
  feedingPresetItems,
  feedingPresets,
  feedingSchedules,
  foodProducts,
  householdInvitations,
  householdMembers,
  households,
  notifications,
  pushDeliveries,
  pushSubscriptions,
  recordChangeLogs,
  users,
} from "@/db/schema";
import { HOUSEHOLD_HAS_CATS_MESSAGE } from "../domain/labels";
import {
  createHousehold,
  deleteHousehold,
  leaveHousehold,
  removeHouseholdMember,
  renameHousehold,
} from "./management";

// `src/features/notifications/queries.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

beforeEach(async () => {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  db = drizzle(sqlite) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
  // D1 と同じく外部キー制約を有効にし、家を削除するときに参照されたままの行があると失敗させる
  sqlite.run("PRAGMA foreign_keys = ON");
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
    { id: "owner", name: "オーナー" },
    { id: "member", name: "家族" },
    { id: "other-owner", name: "別の家の人" },
  ]);
  await db.insert(households).values([
    { id: "home", name: "わが家" },
    { id: "other", name: "別の家" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "home", userId: "owner", role: "owner" },
    { householdId: "home", userId: "member" },
    { householdId: "other", userId: "other-owner", role: "owner" },
  ]);
});

async function getHouseholdName(id: string) {
  const [row] = await db
    .select({ name: households.name })
    .from(households)
    .where(eq(households.id, id));
  return row?.name;
}

async function getMemberIds(householdId: string) {
  const rows = await db
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, householdId));
  return rows.map((row) => row.userId).sort();
}

describe("createHousehold", () => {
  it("家を作成し、作成したユーザーをオーナーにする", async () => {
    const { householdId } = await createHousehold("member", "ねこの家");

    expect(await getHouseholdName(householdId)).toBe("ねこの家");
    const members = await db
      .select({ userId: householdMembers.userId, role: householdMembers.role })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId));
    expect(members).toEqual([{ userId: "member", role: "owner" }]);
  });

  it("すでに家に所属していても、別の家を作成できる", async () => {
    const { householdId } = await createHousehold("owner", "別宅");

    expect(householdId).not.toBe("home");
    expect(await getMemberIds("home")).toEqual(["member", "owner"]);
    expect(await getMemberIds(householdId)).toEqual(["owner"]);
  });

  it("家とオーナーの追加は、1 つの batch（トランザクション）で行う", async () => {
    const batch = vi.spyOn(db, "batch");
    await createHousehold("member", "ねこの家");
    expect(batch).toHaveBeenCalledTimes(1);
  });
});

describe("renameHousehold", () => {
  it("オーナーは家の名前を変えられる", async () => {
    expect(await renameHousehold("home", "owner", "ねこの家")).toEqual({
      ok: true,
    });
    expect(await getHouseholdName("home")).toBe("ねこの家");
  });

  it("オーナー以外のメンバー・別の家のオーナーは変えられない", async () => {
    expect((await renameHousehold("home", "member", "変更")).ok).toBe(false);
    expect((await renameHousehold("home", "other-owner", "変更")).ok).toBe(
      false,
    );
    expect(await getHouseholdName("home")).toBe("わが家");
  });
});

describe("removeHouseholdMember", () => {
  it("オーナーはメンバーを家から外せる", async () => {
    expect(await removeHouseholdMember("home", "owner", "member")).toEqual({
      ok: true,
    });
    expect(await getMemberIds("home")).toEqual(["owner"]);
  });

  it("オーナー以外は外せず、オーナー自身も外せない", async () => {
    expect((await removeHouseholdMember("home", "member", "member")).ok).toBe(
      false,
    );
    expect((await removeHouseholdMember("home", "member", "owner")).ok).toBe(
      false,
    );
    expect((await removeHouseholdMember("home", "owner", "owner")).ok).toBe(
      false,
    );
    // 別の家のオーナーは、この家のメンバーを外せない
    expect(
      (await removeHouseholdMember("home", "other-owner", "member")).ok,
    ).toBe(false);
    expect(await getMemberIds("home")).toEqual(["member", "owner"]);
  });

  it("別の家のメンバーは外せない", async () => {
    await db
      .insert(householdMembers)
      .values({ householdId: "other", userId: "member" });

    expect(
      (await removeHouseholdMember("home", "owner", "other-owner")).ok,
    ).toBe(false);
    expect(await getMemberIds("other")).toEqual(["member", "other-owner"]);
  });
});

describe("leaveHousehold", () => {
  it("メンバーは家から抜けられる", async () => {
    expect(await leaveHousehold("home", "member")).toEqual({ ok: true });
    expect(await getMemberIds("home")).toEqual(["owner"]);
  });

  it("オーナーは抜けられない", async () => {
    expect((await leaveHousehold("home", "owner")).ok).toBe(false);
    const owners = await db
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, "home"),
          eq(householdMembers.role, "owner"),
        ),
      );
    expect(owners).toEqual([{ userId: "owner" }]);
  });

  it("所属していない家からは抜けられない", async () => {
    expect((await leaveHousehold("other", "member")).ok).toBe(false);
  });
});

describe("deleteHousehold", () => {
  /** 家に属するデータを、削除の対象になるテーブルすべてに 1 件ずつ入れる */
  async function seedHouseholdData(householdId: string) {
    await db.insert(expenseRecords).values({
      id: `${householdId}-expense`,
      householdId,
      spentAt: new Date("2024-06-01T00:00:00Z"),
      amountYen: 1000,
      category: "food",
    });
    await db.insert(recordChangeLogs).values({
      recordType: "expense",
      recordId: `${householdId}-expense`,
      action: "create",
      userId: "owner",
    });
    await db.insert(foodProducts).values({
      id: `${householdId}-food`,
      householdId,
      name: "カリカリ",
      manufacturer: "",
      kcalPer100g: 350,
      packageAmountG: 500,
      nutritionType: "complete",
      textureType: "dry",
    });
    await db.insert(feedingPresets).values({
      id: `${householdId}-preset`,
      householdId,
      name: "朝ごはん",
    });
    await db.insert(feedingPresetItems).values({
      presetId: `${householdId}-preset`,
      foodProductId: `${householdId}-food`,
      givenAmountG: 20,
    });
    await db
      .insert(feedingSchedules)
      .values({ id: `${householdId}-schedule`, householdId, time: "07:00" });
    await db.insert(householdInvitations).values({
      householdId,
      tokenHash: `${householdId}-token`,
      createdByUserId: "owner",
      expiresAt: new Date("2099-01-01T00:00:00Z"),
    });
    await db.insert(notifications).values({
      id: `${householdId}-notification`,
      householdId,
      kind: "feeding_time",
      dedupeKey: `${householdId}-feeding`,
      title: "ごはんの時間です",
      body: "",
      url: "/home",
      dueAt: new Date("2024-06-01T00:00:00Z"),
    });
    await db.insert(pushDeliveries).values({
      notificationId: `${householdId}-notification`,
      subscriptionId: "subscription",
    });
  }

  async function countRows(householdId: string) {
    const count = async (rows: Promise<unknown[]>) => (await rows).length;
    return {
      households: await count(
        db.select().from(households).where(eq(households.id, householdId)),
      ),
      members: (await getMemberIds(householdId)).length,
      expenses: await count(
        db
          .select()
          .from(expenseRecords)
          .where(eq(expenseRecords.householdId, householdId)),
      ),
      changeLogs: await count(
        db
          .select()
          .from(recordChangeLogs)
          .where(eq(recordChangeLogs.recordId, `${householdId}-expense`)),
      ),
      foodProducts: await count(
        db
          .select()
          .from(foodProducts)
          .where(eq(foodProducts.householdId, householdId)),
      ),
      presets: await count(
        db
          .select()
          .from(feedingPresets)
          .where(eq(feedingPresets.householdId, householdId)),
      ),
      presetItems: await count(
        db
          .select()
          .from(feedingPresetItems)
          .where(eq(feedingPresetItems.presetId, `${householdId}-preset`)),
      ),
      schedules: await count(
        db
          .select()
          .from(feedingSchedules)
          .where(eq(feedingSchedules.householdId, householdId)),
      ),
      invitations: await count(
        db
          .select()
          .from(householdInvitations)
          .where(eq(householdInvitations.householdId, householdId)),
      ),
      notifications: await count(
        db
          .select()
          .from(notifications)
          .where(eq(notifications.householdId, householdId)),
      ),
      pushDeliveries: await count(
        db
          .select()
          .from(pushDeliveries)
          .where(
            eq(pushDeliveries.notificationId, `${householdId}-notification`),
          ),
      ),
    };
  }

  const SEEDED = {
    households: 1,
    members: 2,
    expenses: 1,
    changeLogs: 1,
    foodProducts: 1,
    presets: 1,
    presetItems: 1,
    schedules: 1,
    invitations: 1,
    notifications: 1,
    pushDeliveries: 1,
  };

  beforeEach(async () => {
    await db.insert(pushSubscriptions).values({
      id: "subscription",
      userId: "member",
      endpoint: "https://push.example.com/1",
      p256dh: "p256dh",
      auth: "auth",
    });
    await db.insert(householdInvitations).values({
      householdId: "other",
      tokenHash: "other-token",
      createdByUserId: "other-owner",
      expiresAt: new Date("2099-01-01T00:00:00Z"),
    });
    await seedHouseholdData("home");
  });

  it("オーナーは、猫のいない家を家に属するデータごと削除できる", async () => {
    expect(await deleteHousehold("home", "owner")).toEqual({ ok: true });

    expect(await countRows("home")).toEqual({
      households: 0,
      members: 0,
      expenses: 0,
      changeLogs: 0,
      foodProducts: 0,
      presets: 0,
      presetItems: 0,
      schedules: 0,
      invitations: 0,
      notifications: 0,
      pushDeliveries: 0,
    });
    // ほかの家は消さない
    expect(await getHouseholdName("other")).toBe("別の家");
    expect(await getMemberIds("other")).toEqual(["other-owner"]);
    expect(
      await db
        .select()
        .from(householdInvitations)
        .where(eq(householdInvitations.householdId, "other")),
    ).toHaveLength(1);
  });

  it("猫・通院記録の紐付けが残った支出も削除できる", async () => {
    // 猫を削除すると支出との紐付けも外れるが、外れずに残っていても削除できることを確かめる
    await db.insert(cats).values({
      id: "other-cat",
      householdId: "other",
      name: "たま",
      sex: "female",
    });
    await db
      .insert(expenseRecordCats)
      .values({ expenseRecordId: "home-expense", catId: "other-cat" });

    expect(await deleteHousehold("home", "owner")).toEqual({ ok: true });
    expect(await getHouseholdName("home")).toBeUndefined();
    expect(await db.select().from(expenseRecordCats)).toEqual([]);
  });

  it("家に猫がいれば、何も削除せずに理由を返す", async () => {
    await db.insert(cats).values({
      id: "cat",
      householdId: "home",
      name: "たま",
      sex: "female",
    });

    expect(await deleteHousehold("home", "owner")).toEqual({
      ok: false,
      error: HOUSEHOLD_HAS_CATS_MESSAGE,
    });
    expect(await countRows("home")).toEqual(SEEDED);
  });

  it("オーナーでないメンバーは、何も削除できない", async () => {
    expect(await deleteHousehold("home", "member")).toEqual({
      ok: false,
      error: "家を削除できるのはオーナーだけです",
    });
    expect(await countRows("home")).toEqual(SEEDED);
  });

  it("ほかの家のオーナーは、何も削除できない", async () => {
    expect((await deleteHousehold("home", "other-owner")).ok).toBe(false);
    expect(await countRows("home")).toEqual(SEEDED);
  });

  it("オーナーを移譲した元のオーナーは、削除できない", async () => {
    await db
      .update(householdMembers)
      .set({ role: "member" })
      .where(eq(householdMembers.userId, "owner"));
    await db
      .update(householdMembers)
      .set({ role: "owner" })
      .where(
        and(
          eq(householdMembers.householdId, "home"),
          eq(householdMembers.userId, "member"),
        ),
      );

    expect((await deleteHousehold("home", "owner")).ok).toBe(false);
    expect(await countRows("home")).toEqual(SEEDED);
  });
});
