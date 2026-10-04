// @vitest-environment node
import { eq } from "drizzle-orm";
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
  await db
    .insert(households)
    .values({ id: "home", name: "わが家", ownerUserId: "owner" });
  await db.insert(householdMembers).values([
    { householdId: "home", userId: "owner" },
    { householdId: "home", userId: "member" },
  ]);
});

async function getOwner() {
  const [household] = await db
    .select({ ownerUserId: households.ownerUserId })
    .from(households)
    .where(eq(households.id, "home"));
  return household.ownerUserId;
}

describe("transferHouseholdOwnership", () => {
  it("オーナーは同じ家のメンバーへオーナーを移譲できる", async () => {
    expect(await transferHouseholdOwnership("home", "owner", "member")).toEqual(
      { ok: true },
    );
    expect(await getOwner()).toBe("member");

    // 移譲後は新しいオーナーがさらに移譲できる
    expect(await transferHouseholdOwnership("home", "member", "owner")).toEqual(
      { ok: true },
    );
    expect(await getOwner()).toBe("owner");
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
    expect(await getOwner()).toBe("owner");
  });

  it("家のメンバーでないユーザーには移譲できない", async () => {
    const result = await transferHouseholdOwnership(
      "home",
      "owner",
      "stranger",
    );
    expect(result.ok).toBe(false);
    expect(await getOwner()).toBe("owner");
  });
});
