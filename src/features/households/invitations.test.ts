// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  householdInvitations,
  householdMembers,
  households,
  users,
} from "@/db/schema";
import {
  acceptHouseholdInvitation,
  createHouseholdInvitation,
  getHouseholdInvitationPreview,
  HOUSEHOLD_INVITATION_MAX_AGE_SECONDS,
  listPendingHouseholdInvitations,
  revokeHouseholdInvitation,
} from "./invitations";
import { leaveHousehold } from "./management";
import { transferHouseholdOwnership } from "./ownership";

// `management.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
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
    { id: "guest", name: "招待された人" },
    { id: "another-guest", name: "別の招待された人" },
  ]);
  await db.insert(households).values({ id: "home", name: "わが家" });
  await db.insert(householdMembers).values([
    { householdId: "home", userId: "owner", role: "owner" },
    { householdId: "home", userId: "member" },
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});

async function issueInvitation() {
  const result = await createHouseholdInvitation("home", "owner");
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result;
}

async function getMemberIds() {
  const rows = await db
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, "home"));
  return rows.map((row) => row.userId).sort();
}

describe("createHouseholdInvitation", () => {
  it("オーナーは招待を発行でき、トークンのハッシュだけが保存される", async () => {
    const { token, expiresAt } = await issueInvitation();

    const rows = await db.select().from(householdInvitations);
    expect(rows).toHaveLength(1);
    expect(rows[0].householdId).toBe("home");
    expect(rows[0].createdByUserId).toBe("owner");
    expect(rows[0].tokenHash).not.toBe(token);
    expect(rows[0].expiresAt.getTime()).toBe(
      Math.floor(expiresAt.getTime() / 1000) * 1000,
    );
    expect(rows[0].acceptedByUserId).toBeNull();
  });

  it("オーナー以外のメンバー・家に所属していないユーザーは発行できない", async () => {
    expect((await createHouseholdInvitation("home", "member")).ok).toBe(false);
    expect((await createHouseholdInvitation("home", "guest")).ok).toBe(false);
    expect(await db.select().from(householdInvitations)).toHaveLength(0);
  });

  it("移譲で元のオーナーになったユーザーは発行できない", async () => {
    await transferHouseholdOwnership("home", "owner", "member");
    expect((await createHouseholdInvitation("home", "owner")).ok).toBe(false);
    expect((await createHouseholdInvitation("home", "member")).ok).toBe(true);
  });

  it("期限切れで未使用の招待は、次に発行したときに削除される", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    await issueInvitation();

    vi.setSystemTime(
      new Date(
        Date.parse("2026-10-01T00:00:00Z") +
          HOUSEHOLD_INVITATION_MAX_AGE_SECONDS * 1000,
      ),
    );
    await issueInvitation();
    expect(await db.select().from(householdInvitations)).toHaveLength(1);
  });
});

describe("listPendingHouseholdInvitations", () => {
  it("未使用で期限内の招待だけを返す", async () => {
    const used = await issueInvitation();
    await acceptHouseholdInvitation(used.token, "guest");
    await issueInvitation();

    const pending = await listPendingHouseholdInvitations("home");
    expect(pending).toHaveLength(1);
    expect(pending[0].createdByName).toBe("オーナー");
  });
});

describe("revokeHouseholdInvitation", () => {
  it("オーナーは招待を無効化でき、無効化した招待では参加できない", async () => {
    const { token } = await issueInvitation();
    const [{ id }] = await listPendingHouseholdInvitations("home");

    expect(await revokeHouseholdInvitation("home", "owner", id)).toEqual({
      ok: true,
    });
    expect(await getHouseholdInvitationPreview(token, "guest")).toEqual({
      status: "invalid",
    });
    expect((await acceptHouseholdInvitation(token, "guest")).ok).toBe(false);
    expect(await getMemberIds()).toEqual(["member", "owner"]);
  });

  it("オーナー以外は無効化できない", async () => {
    await issueInvitation();
    const [{ id }] = await listPendingHouseholdInvitations("home");

    expect((await revokeHouseholdInvitation("home", "member", id)).ok).toBe(
      false,
    );
    expect(await listPendingHouseholdInvitations("home")).toHaveLength(1);
  });

  it("使用済みの招待は無効化できない（参加したメンバーの記録を残す）", async () => {
    const { token } = await issueInvitation();
    const [{ id }] = await listPendingHouseholdInvitations("home");
    await acceptHouseholdInvitation(token, "guest");

    expect((await revokeHouseholdInvitation("home", "owner", id)).ok).toBe(
      false,
    );
  });
});

describe("acceptHouseholdInvitation", () => {
  it("招待されたユーザーは家にメンバーとして参加できる", async () => {
    const { token } = await issueInvitation();
    expect(await getHouseholdInvitationPreview(token, "guest")).toMatchObject({
      status: "valid",
      householdName: "わが家",
      createdByName: "オーナー",
    });

    expect(await acceptHouseholdInvitation(token, "guest")).toEqual({
      ok: true,
      householdId: "home",
    });
    const [member] = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, "guest"));
    expect(member.role).toBe("member");

    const [invitation] = await db.select().from(householdInvitations);
    expect(invitation.acceptedByUserId).toBe("guest");
    expect(invitation.acceptedAt).not.toBeNull();
  });

  it("1 つの招待で参加できるのは 1 人だけ", async () => {
    const { token } = await issueInvitation();
    await acceptHouseholdInvitation(token, "guest");

    expect(await getHouseholdInvitationPreview(token, "another-guest")).toEqual(
      { status: "invalid" },
    );
    expect((await acceptHouseholdInvitation(token, "another-guest")).ok).toBe(
      false,
    );
    expect(await getMemberIds()).toEqual(["guest", "member", "owner"]);
  });

  it("同時に参加しようとしても、参加できるのは 1 人だけ", async () => {
    const { token } = await issueInvitation();
    const results = await Promise.all([
      acceptHouseholdInvitation(token, "guest"),
      acceptHouseholdInvitation(token, "another-guest"),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await getMemberIds()).toHaveLength(3);
  });

  it("すでにメンバーのユーザーが開いても、招待は使用済みにならない", async () => {
    const { token } = await issueInvitation();
    expect(await getHouseholdInvitationPreview(token, "owner")).toEqual({
      status: "member",
      householdId: "home",
      householdName: "わが家",
    });
    expect((await acceptHouseholdInvitation(token, "owner")).ok).toBe(false);

    expect(await acceptHouseholdInvitation(token, "guest")).toEqual({
      ok: true,
      householdId: "home",
    });
  });

  it("参加したあとに家から抜けたユーザーは、同じ招待で参加し直せない", async () => {
    const { token } = await issueInvitation();
    await acceptHouseholdInvitation(token, "guest");
    await leaveHousehold("home", "guest");

    expect(await getHouseholdInvitationPreview(token, "guest")).toEqual({
      status: "invalid",
    });
    expect((await acceptHouseholdInvitation(token, "guest")).ok).toBe(false);
    expect(await getMemberIds()).toEqual(["member", "owner"]);
  });

  it("期限切れの招待では参加できない", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    const { token, expiresAt } = await issueInvitation();

    vi.setSystemTime(expiresAt);
    expect(await getHouseholdInvitationPreview(token, "guest")).toEqual({
      status: "invalid",
    });
    expect((await acceptHouseholdInvitation(token, "guest")).ok).toBe(false);
  });

  it("存在しないトークンでは参加できない", async () => {
    expect(await getHouseholdInvitationPreview("unknown", "guest")).toEqual({
      status: "invalid",
    });
    expect((await acceptHouseholdInvitation("unknown", "guest")).ok).toBe(
      false,
    );
  });
});
