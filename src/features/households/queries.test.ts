// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { cats, householdMembers, households, users } from "@/db/schema";
import {
  getCatForUser,
  getPrimaryHouseholdForUser,
  listCatsForUser,
} from "./queries";

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
    { id: "owner", name: "オーナー", role: "admin" },
    { id: "member", name: "家族" },
    { id: "stranger", name: "別の家の人" },
    { id: "homeless", name: "家のない人" },
  ]);
  await db.insert(households).values([
    { id: "home", name: "わが家" },
    { id: "other", name: "別の家" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "home", userId: "owner", role: "owner" },
    { householdId: "home", userId: "member" },
    { householdId: "other", userId: "stranger", role: "owner" },
  ]);
  await db.insert(cats).values([
    {
      id: "tama",
      name: "たま",
      sex: "female",
      householdId: "home",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      id: "mike",
      name: "ミケ",
      sex: "female",
      householdId: "home",
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
    },
    { id: "kuro", name: "クロ", sex: "male", householdId: "other" },
    // 家の導入前から登録されていて、まだ家に紐付けていない猫
    { id: "orphan", name: "シロ", sex: "unknown" },
  ]);
});

describe("listCatsForUser", () => {
  it("所属する家の猫だけを新しく登録した順に返す", async () => {
    const owned = await listCatsForUser("owner");
    expect(owned.map((cat) => cat.id)).toEqual(["mike", "tama"]);

    // オーナー以外のメンバーも同じ猫を参照できる
    const shared = await listCatsForUser("member");
    expect(shared.map((cat) => cat.id)).toEqual(["mike", "tama"]);
  });

  it("家に所属していないユーザーには猫を返さない", async () => {
    expect(await listCatsForUser("homeless")).toEqual([]);
  });
});

describe("getCatForUser", () => {
  it("所属する家の猫を返す", async () => {
    expect((await getCatForUser("member", "tama"))?.name).toBe("たま");
  });

  it("別の家の猫・家に紐付いていない猫・存在しない猫は null", async () => {
    expect(await getCatForUser("owner", "kuro")).toBeNull();
    expect(await getCatForUser("owner", "orphan")).toBeNull();
    expect(await getCatForUser("owner", "missing")).toBeNull();
  });
});

describe("getPrimaryHouseholdForUser", () => {
  it("所属する家と家の中での権限を返し、所属していなければ null", async () => {
    expect(await getPrimaryHouseholdForUser("member")).toEqual({
      id: "home",
      name: "わが家",
      role: "member",
    });
    expect(await getPrimaryHouseholdForUser("owner")).toEqual({
      id: "home",
      name: "わが家",
      role: "owner",
    });
    expect(await getPrimaryHouseholdForUser("homeless")).toBeNull();
  });
});
