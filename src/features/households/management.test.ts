// @vitest-environment node
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { householdMembers, households, users } from "@/db/schema";
import {
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
  db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
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
