import { beforeEach, describe, expect, it } from "vitest";
import { createMigratedDatabase, toAdminDb } from "../test/d1";
import { BASE_TIME, seed } from "../test/fixtures";
import {
  type AdminDb,
  addHouseholdMember,
  deleteUserSessions,
  getOverview,
  listHouseholds,
  listUsers,
  removeHouseholdMember,
  updateUserRole,
} from "./queries";

const NOW = new Date(BASE_TIME * 1000);

let db: AdminDb;

beforeEach(async () => {
  const database = await createMigratedDatabase();
  seed(database);
  db = toAdminDb(database);
});

describe("getOverview", () => {
  it("ユーザー・家・猫と、家に未所属の猫の数を数える", async () => {
    expect(await getOverview(db)).toEqual({
      userCount: 3,
      householdCount: 2,
      catCount: 3,
      unassignedCatCount: 1,
    });
  });

  it("データが無くても 0 を返す", async () => {
    const empty = toAdminDb(await createMigratedDatabase());
    expect(await getOverview(empty)).toEqual({
      userCount: 0,
      householdCount: 0,
      catCount: 0,
      unassignedCatCount: 0,
    });
  });
});

describe("listUsers", () => {
  it("登録順に並べ、有効なセッションだけを数える", async () => {
    const users = await listUsers(db, NOW);
    expect(users.map((user) => user.id)).toEqual([
      "user-1",
      "user-2",
      "user-3",
    ]);
    expect(users[0]).toMatchObject({
      name: "たろう",
      role: "admin",
      createdAt: NOW,
      activeSessionCount: 2,
      latestSessionExpiresAt: new Date((BASE_TIME + 172_800) * 1000),
    });
    // 期限切れのセッションしかないユーザー
    expect(users[2]).toMatchObject({
      activeSessionCount: 0,
      latestSessionExpiresAt: null,
      households: [],
    });
  });

  it("所属する家と、その家での権限を返す", async () => {
    const [owner, member] = await listUsers(db, NOW);
    expect(owner.households).toEqual([
      { householdId: "household-1", householdName: "わが家", role: "owner" },
      { householdId: "household-2", householdName: "実家", role: "owner" },
    ]);
    expect(member.households).toEqual([
      { householdId: "household-1", householdName: "わが家", role: "member" },
    ]);
  });
});

describe("listHouseholds", () => {
  it("作成順に並べ、メンバーはオーナーを先にする", async () => {
    const households = await listHouseholds(db);
    expect(households).toEqual([
      {
        id: "household-1",
        name: "わが家",
        createdAt: NOW,
        catCount: 2,
        members: [
          { userId: "user-1", userName: "たろう", role: "owner" },
          {
            userId: "user-2",
            userName: "<script>alert(1)</script>",
            role: "member",
          },
        ],
      },
      {
        id: "household-2",
        name: "実家",
        createdAt: new Date((BASE_TIME + 60) * 1000),
        catCount: 0,
        members: [{ userId: "user-1", userName: "たろう", role: "owner" }],
      },
    ]);
  });
});

describe("deleteUserSessions", () => {
  it("そのユーザーのセッションだけを、期限切れのものも含めてすべて削除する", async () => {
    expect(await deleteUserSessions(db, "user-1")).toBe(3);

    const users = await listUsers(db, NOW);
    expect(users[0].activeSessionCount).toBe(0);
    // ほかのユーザーのセッションは残る
    expect(await deleteUserSessions(db, "user-3")).toBe(1);
  });

  it("セッションが無いユーザーでは何も削除しない", async () => {
    expect(await deleteUserSessions(db, "user-2")).toBe(0);
  });
});

describe("updateUserRole", () => {
  it("ユーザーの権限を変え、ほかのユーザーの権限は変えない", async () => {
    expect(await updateUserRole(db, "user-3", "admin")).toEqual({ ok: true });
    expect(await updateUserRole(db, "user-1", "member")).toEqual({ ok: true });

    const users = await listUsers(db, NOW);
    expect(users.map((user) => `${user.id}:${user.role}`)).toEqual([
      "user-1:member",
      "user-2:member",
      "user-3:admin",
    ]);
  });

  it("家の中での権限は変えない", async () => {
    await updateUserRole(db, "user-1", "member");
    expect(await memberIds("household-1")).toEqual([
      "user-1:owner",
      "user-2:member",
    ]);
  });

  it("選べない権限には変えない", async () => {
    const result = await updateUserRole(db, "user-3", "owner");
    expect(result.ok).toBe(false);
    const users = await listUsers(db, NOW);
    expect(users[2].role).toBe("member");
  });

  it("存在しないユーザーでは失敗を返す", async () => {
    expect((await updateUserRole(db, "missing", "admin")).ok).toBe(false);
  });
});

async function memberIds(householdId: string) {
  const households = await listHouseholds(db);
  return households
    .find((household) => household.id === householdId)
    ?.members.map((member) => `${member.userId}:${member.role}`);
}

describe("addHouseholdMember", () => {
  it("ユーザーを家のメンバー（member）として追加する", async () => {
    expect(await addHouseholdMember(db, "household-2", "user-3")).toEqual({
      ok: true,
    });
    expect(await memberIds("household-2")).toEqual([
      "user-1:owner",
      "user-3:member",
    ]);
  });

  it("すでにメンバーのユーザーは追加せず、権限も変えない", async () => {
    const result = await addHouseholdMember(db, "household-1", "user-1");
    expect(result.ok).toBe(false);
    expect(await memberIds("household-1")).toEqual([
      "user-1:owner",
      "user-2:member",
    ]);
  });

  it("存在しない家・ユーザーには追加しない", async () => {
    expect((await addHouseholdMember(db, "missing", "user-3")).ok).toBe(false);
    expect((await addHouseholdMember(db, "household-2", "missing")).ok).toBe(
      false,
    );
    expect(await memberIds("household-2")).toEqual(["user-1:owner"]);
  });
});

describe("removeHouseholdMember", () => {
  it("オーナー以外のメンバーを家から外す", async () => {
    expect(await removeHouseholdMember(db, "household-1", "user-2")).toEqual({
      ok: true,
    });
    expect(await memberIds("household-1")).toEqual(["user-1:owner"]);
    // ほかの家の所属は変わらない
    expect(await memberIds("household-2")).toEqual(["user-1:owner"]);
  });

  it("オーナーは外さない", async () => {
    const result = await removeHouseholdMember(db, "household-1", "user-1");
    expect(result.ok).toBe(false);
    expect(await memberIds("household-1")).toEqual([
      "user-1:owner",
      "user-2:member",
    ]);
  });

  it("メンバーでないユーザーでは何もしない", async () => {
    expect((await removeHouseholdMember(db, "household-1", "user-3")).ok).toBe(
      false,
    );
  });
});
