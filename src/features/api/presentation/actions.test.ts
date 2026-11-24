// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { apiTokens, users } from "@/db/schema";
import {
  DEFAULT_PERMISSIONS,
  PERMISSIONS_FIELD_NAME,
} from "@/features/external-access/domain/permissionRules";
import {
  createApiTokenAction,
  deleteApiTokenAction,
  updateApiTokenPermissionsAction,
} from "./actions";

let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/features/auth/presentation/session", () => ({ requireUser }));

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に D1 の batch を簡易実装する
  (db as any).batch = async (statements: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement);
    }
    return results;
  };
  await db.insert(users).values([
    { id: "user-1", name: "ユーザー1" },
    { id: "user-2", name: "ユーザー2" },
  ]);
  requireUser.mockResolvedValue({ id: "user-1" });
});

function formData(values: Record<string, string>) {
  const data = new FormData();
  const fields = {
    [PERMISSIONS_FIELD_NAME]: JSON.stringify(DEFAULT_PERMISSIONS),
    ...values,
  };
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

async function issue() {
  const result = await createApiTokenAction(
    {},
    formData({ name: " 体重計 ", expiration: "none" }),
  );
  const [row] = await db.select().from(apiTokens);
  return { result, row };
}

describe("createApiTokenAction", () => {
  it("ログイン中のユーザーのトークンを発行し、トークンを 1 回だけ返す", async () => {
    const { result, row } = await issue();
    expect(result.issued?.token).toMatch(/^canshi_/);
    expect(result.issued?.expiresAt).toBeNull();
    expect(row).toMatchObject({
      userId: "user-1",
      name: "体重計",
      expiresAt: null,
    });
  });

  it.each([
    [{ name: " ", expiration: "7d" }, "name"],
    [{ name: "あ".repeat(51), expiration: "7d" }, "name"],
    [{ name: "トークン", expiration: "365d" }, "expiration"],
    [{ name: "トークン" }, "expiration"],
  ])("入力が正しくなければ発行しない（%o）", async (values, field) => {
    const result = await createApiTokenAction(
      {},
      formData(values as Record<string, string>),
    );
    expect(result.fieldErrors).toHaveProperty(field);
    expect(await db.select().from(apiTokens)).toEqual([]);
  });

  it("許可する範囲の形が正しくなければ発行しない", async () => {
    const result = await createApiTokenAction(
      {},
      formData({
        name: "トークン",
        expiration: "7d",
        [PERMISSIONS_FIELD_NAME]: "{",
      }),
    );
    expect(result.formError).toBeDefined();
    expect(await db.select().from(apiTokens)).toEqual([]);
  });
});

describe("ほかのユーザーのトークン", () => {
  it("範囲を変えられず、削除もできない", async () => {
    const { row } = await issue();
    requireUser.mockResolvedValue({ id: "user-2" });

    const result = await updateApiTokenPermissionsAction(
      row.id,
      {},
      formData({}),
    );
    expect(result.formError).toContain("トークンが見つかりません");
    await deleteApiTokenAction(row.id);

    expect(await db.select().from(apiTokens)).toEqual([row]);
  });
});
