// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  householdMembers,
  households,
  pushSubscriptions,
  users,
} from "@/db/schema";
import { listCatAccessesOfSubscribers, listPushSubscriptions } from "./queries";

// `src/features/notifications/queries.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

beforeAll(async () => {
  const SQL = await initSqlJs();
  db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });

  await db.insert(users).values([
    { id: "owner", name: "オーナー" },
    { id: "neighbor", name: "別の家の人" },
    { id: "quiet", name: "購読していない人" },
  ]);
  await db.insert(households).values([
    { id: "home", name: "わが家" },
    { id: "other", name: "別の家" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "home", userId: "owner", role: "owner" },
    { householdId: "home", userId: "quiet" },
    { householdId: "other", userId: "neighbor", role: "owner" },
  ]);
  await db.insert(cats).values([
    { id: "tama", name: "たま", sex: "female", householdId: "home" },
    { id: "kuro", name: "クロ", sex: "male", householdId: "other" },
  ]);
  const keys = { p256dh: "p256dh", auth: "auth" };
  await db.insert(pushSubscriptions).values([
    { id: "owner-phone", userId: "owner", endpoint: "https://push/1", ...keys },
    {
      id: "neighbor-phone",
      userId: "neighbor",
      endpoint: "https://push/2",
      ...keys,
    },
    // ユーザーの導入前に登録された購読
    { id: "legacy", endpoint: "https://push/3", ...keys },
  ]);
});

describe("listPushSubscriptions", () => {
  it("ユーザーに紐付いた購読だけを返す", async () => {
    const subscriptions = await listPushSubscriptions();
    expect(subscriptions.map((subscription) => subscription.id).sort()).toEqual(
      ["neighbor-phone", "owner-phone"],
    );
  });
});

describe("listCatAccessesOfSubscribers", () => {
  it("購読しているユーザーと、その家の猫の組を返す", async () => {
    const accesses = await listCatAccessesOfSubscribers();
    expect(
      accesses.map(({ userId, catId }) => `${userId}:${catId}`).sort(),
    ).toEqual(["neighbor:kuro", "owner:tama"]);
  });
});
