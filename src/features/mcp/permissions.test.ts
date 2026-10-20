// @vitest-environment node

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  householdMembers,
  households,
  mcpPermissions,
  users,
} from "@/db/schema";
import { DEFAULT_MCP_PERMISSIONS, isCatAllowedForMcp } from "./permissionRules";
import {
  deleteMcpPermissions,
  getMcpPermissions,
  getMcpPermissionTree,
  saveMcpPermissionsFromForm,
} from "./permissions";

// `src/features/auth/sessions.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
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
    { id: "user-1", name: "ユーザー1" },
    { id: "user-2", name: "ユーザー2" },
  ]);
  await db.insert(households).values([
    { id: "house-1", name: "家1" },
    { id: "house-2", name: "家2" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "house-1", userId: "user-1", role: "owner" },
    { householdId: "house-2", userId: "user-2", role: "owner" },
  ]);
  await db.insert(cats).values([
    {
      id: "cat-1",
      name: "たま",
      sex: "female",
      householdId: "house-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
    {
      id: "cat-2",
      name: "みけ",
      sex: "female",
      householdId: "house-1",
      createdAt: new Date("2026-02-01T00:00:00Z"),
    },
    {
      id: "cat-3",
      name: "くろ",
      sex: "male",
      householdId: "house-2",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
  ]);
});

function form(value: unknown) {
  const formData = new FormData();
  formData.set("mcpPermissions", JSON.stringify(value));
  return formData;
}

describe("getMcpPermissions", () => {
  it("保存していない接続は、何も外していないが、書き込みはどれも許可していない状態を返す", async () => {
    expect(await getMcpPermissions("user-1", "client-1")).toEqual(
      DEFAULT_MCP_PERMISSIONS,
    );
  });

  it("書き込みの列を指定せずに保存した接続は、書き込みをどれも許可していない", async () => {
    await db
      .insert(mcpPermissions)
      .values({ userId: "user-1", clientId: "client-1" });

    expect(await getMcpPermissions("user-1", "client-1")).toMatchObject({
      writableRecordTypes: {},
      householdOperations: {},
    });
  });

  it("知らない記録の種類・操作が保存されていても読み飛ばす", async () => {
    await db.insert(mcpPermissions).values({
      userId: "user-1",
      clientId: "client-1",
      excludedRecordTypes: { "cat-1": ["poop", "removed-type"] },
      writableRecordTypes: { "cat-1": ["feeding", "removed-type"] },
      householdOperations: {
        "house-1": ["foodProduct:read", "removed-operation"],
      },
      catalogOperations: ["catalogFoodProduct:read", "removed-operation"],
    });

    expect(await getMcpPermissions("user-1", "client-1")).toEqual({
      excludedHouseholdIds: [],
      excludedCatIds: [],
      excludedRecordTypes: { "cat-1": ["poop"] },
      writableRecordTypes: { "cat-1": ["feeding"] },
      householdOperations: { "house-1": ["foodProduct:read"] },
      catalogOperations: ["catalogFoodProduct:read"],
    });
  });
});

describe("saveMcpPermissionsFromForm", () => {
  it("ユーザーの家・猫だけを保存し、もう一度保存すると置き換える", async () => {
    expect(
      await saveMcpPermissionsFromForm(
        "user-1",
        "client-1",
        form({
          excludedHouseholdIds: ["house-2"],
          excludedCatIds: ["cat-2", "cat-3"],
          excludedRecordTypes: { "cat-1": ["water"], "cat-3": ["water"] },
          writableRecordTypes: { "cat-1": ["feeding"], "cat-3": ["feeding"] },
          householdOperations: {
            "house-1": ["foodProduct:read"],
            "house-2": ["foodProduct:read"],
          },
        }),
      ),
    ).toBe(true);
    expect(await getMcpPermissions("user-1", "client-1")).toEqual({
      excludedHouseholdIds: [],
      excludedCatIds: ["cat-2"],
      excludedRecordTypes: { "cat-1": ["water"] },
      writableRecordTypes: { "cat-1": ["feeding"] },
      householdOperations: { "house-1": ["foodProduct:read"] },
      catalogOperations: [],
    });

    expect(
      await saveMcpPermissionsFromForm(
        "user-1",
        "client-1",
        form({
          excludedHouseholdIds: ["house-1"],
          excludedCatIds: [],
          excludedRecordTypes: {},
        }),
      ),
    ).toBe(true);
    expect(await getMcpPermissions("user-1", "client-1")).toEqual({
      ...DEFAULT_MCP_PERMISSIONS,
      excludedHouseholdIds: ["house-1"],
    });
    // ほかのユーザーの範囲・同じユーザーのほかの接続の範囲には影響しない
    expect(await getMcpPermissions("user-2", "client-1")).toEqual(
      DEFAULT_MCP_PERMISSIONS,
    );
    expect(await getMcpPermissions("user-1", "client-2")).toEqual(
      DEFAULT_MCP_PERMISSIONS,
    );
  });

  it("外した家の猫は、読み取りを許可した家へ引っ越しても読み取れないまま", async () => {
    await db
      .insert(householdMembers)
      .values({ householdId: "house-2", userId: "user-1", role: "member" });
    // 画面で家1を外すと、家1の猫も外したものとして送られる
    await saveMcpPermissionsFromForm(
      "user-1",
      "client-1",
      form({
        excludedHouseholdIds: ["house-1"],
        excludedCatIds: ["cat-1", "cat-2"],
        excludedRecordTypes: {},
      }),
    );

    await db
      .update(cats)
      .set({ householdId: "house-2" })
      .where(eq(cats.id, "cat-1"));

    const permissions = await getMcpPermissions("user-1", "client-1");
    expect(
      isCatAllowedForMcp(permissions, { id: "cat-1", householdId: "house-2" }),
    ).toBe(false);
    expect(
      isCatAllowedForMcp(permissions, { id: "cat-3", householdId: "house-2" }),
    ).toBe(true);
  });

  it("共通のごはん商品の操作は、admin のユーザーのときだけ保存する", async () => {
    const value = {
      excludedHouseholdIds: [],
      excludedCatIds: [],
      excludedRecordTypes: {},
      catalogOperations: ["catalogFoodProduct:read"],
    };
    await saveMcpPermissionsFromForm("user-1", "client-1", form(value));
    expect(
      (await getMcpPermissions("user-1", "client-1")).catalogOperations,
    ).toEqual([]);

    await db.update(users).set({ role: "admin" }).where(eq(users.id, "user-1"));
    await saveMcpPermissionsFromForm("user-1", "client-1", form(value));
    expect(
      (await getMcpPermissions("user-1", "client-1")).catalogOperations,
    ).toEqual(["catalogFoodProduct:read"]);
  });

  it("形が正しくなければ保存しない", async () => {
    const formData = new FormData();
    formData.set("mcpPermissions", "{");

    expect(
      await saveMcpPermissionsFromForm("user-1", "client-1", formData),
    ).toBe(false);
    expect(await db.select().from(mcpPermissions)).toEqual([]);
  });
});

describe("deleteMcpPermissions", () => {
  it("指定した接続の範囲だけを消す", async () => {
    await db.insert(mcpPermissions).values([
      { userId: "user-1", clientId: "client-1", excludedCatIds: ["cat-1"] },
      { userId: "user-1", clientId: "client-2", excludedCatIds: ["cat-2"] },
    ]);

    await deleteMcpPermissions("user-1", "client-1");

    expect(await getMcpPermissions("user-1", "client-1")).toEqual(
      DEFAULT_MCP_PERMISSIONS,
    );
    expect(
      (await getMcpPermissions("user-1", "client-2")).excludedCatIds,
    ).toEqual(["cat-2"]);
  });
});

describe("getMcpPermissionTree", () => {
  it("ユーザーの家ごとに、猫を登録した順に並べてチェックの状態を返す", async () => {
    await saveMcpPermissionsFromForm(
      "user-1",
      "client-1",
      form({
        excludedHouseholdIds: [],
        excludedCatIds: ["cat-2"],
        excludedRecordTypes: {},
      }),
    );

    const { households } = await getMcpPermissionTree("user-1", "client-1");

    expect(households).toHaveLength(1);
    expect(households[0]).toMatchObject({
      id: "house-1",
      name: "家1",
      checked: true,
    });
    expect(
      households[0].cats.map(({ id, checked }) => ({ id, checked })),
    ).toEqual([
      { id: "cat-1", checked: true },
      { id: "cat-2", checked: false },
    ]);
  });

  it("共通のごはん商品の操作は、admin のユーザーのときだけ返す", async () => {
    await db.insert(mcpPermissions).values({
      userId: "user-1",
      clientId: "client-1",
      catalogOperations: ["catalogFoodProduct:create"],
    });

    expect(
      (await getMcpPermissionTree("user-1", "client-1")).catalogOperations,
    ).toBeNull();

    await db.update(users).set({ role: "admin" }).where(eq(users.id, "user-1"));
    expect(
      (await getMcpPermissionTree("user-1", "client-1")).catalogOperations,
    ).toEqual(["catalogFoodProduct:create"]);
  });
});
