// @vitest-environment node
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { householdMembers, households, users } from "@/db/schema";
import { transferHouseholdOwnership } from "./ownership";

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
    { id: "stranger", name: "別の家の人" },
  ]);
  await db.insert(households).values({ id: "home", name: "わが家" });
  await db.insert(householdMembers).values([
    { householdId: "home", userId: "owner", role: "owner" },
    { householdId: "home", userId: "member" },
  ]);
});

/** 家のオーナーの ID 一覧（移譲の前後でちょうど 1 名であることを確かめる） */
async function getOwners() {
  const rows = await db
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, "home"),
        eq(householdMembers.role, "owner"),
      ),
    );
  return rows.map((row) => row.userId);
}

describe("transferHouseholdOwnership", () => {
  it("オーナーは同じ家のメンバーへオーナーを移譲できる", async () => {
    expect(await transferHouseholdOwnership("home", "owner", "member")).toEqual(
      { ok: true },
    );
    expect(await getOwners()).toEqual(["member"]);

    // 移譲後は新しいオーナーがさらに移譲できる
    expect(await transferHouseholdOwnership("home", "member", "owner")).toEqual(
      { ok: true },
    );
    expect(await getOwners()).toEqual(["owner"]);
  });

  it("オーナー以外は移譲できない", async () => {
    const result = await transferHouseholdOwnership("home", "member", "member");
    expect(result.ok).toBe(false);

    const byMember = await transferHouseholdOwnership(
      "home",
      "stranger",
      "member",
    );
    expect(byMember.ok).toBe(false);
    expect(await getOwners()).toEqual(["owner"]);
  });

  it("家のメンバーでないユーザーには移譲できない", async () => {
    const result = await transferHouseholdOwnership(
      "home",
      "owner",
      "stranger",
    );
    expect(result.ok).toBe(false);
    expect(await getOwners()).toEqual(["owner"]);
  });

  it("すでにオーナーのメンバーへ移譲しても、移譲元はオーナーのまま", async () => {
    // 今後オーナーが複数になった場合に、移譲元だけが降格してしまわないことを確かめる
    await db
      .update(householdMembers)
      .set({ role: "owner" })
      .where(eq(householdMembers.userId, "member"));

    const result = await transferHouseholdOwnership("home", "owner", "member");
    expect(result.ok).toBe(false);
    expect((await getOwners()).sort()).toEqual(["member", "owner"]);
  });
});
