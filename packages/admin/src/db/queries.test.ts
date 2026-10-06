import { beforeEach, describe, expect, it } from "vitest";
import { createMigratedDatabase, toAdminDb } from "../test/d1";
import { BASE_TIME, seed } from "../test/fixtures";
import {
  type AdminDb,
  getOverview,
  listHouseholds,
  listUsers,
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
