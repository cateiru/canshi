// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { apiAccessLogs, apiTokens, cats, users } from "@/db/schema";
import { DEFAULT_PERMISSIONS } from "@/features/external-access/domain/permissionRules";
import {
  findApiTokenAccess,
  getApiTokenForUser,
  listApiTokensForUser,
} from "../infrastructure/queries";
import {
  createApiToken,
  deleteApiToken,
  recordApiAccess,
  updateApiTokenPermissions,
} from "./mutations";

let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const ACCESS = {
  method: "GET",
  path: "/api/v1/cats",
  status: 200,
  ipAddress: "192.0.2.1",
  userAgent: "curl/8.0",
};

beforeEach(async () => {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  db = drizzle(sqlite) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
  sqlite.run("PRAGMA foreign_keys = ON");
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
  await db.insert(cats).values([
    { id: "cat-1", name: "たま", sex: "female" },
    { id: "cat-2", name: "くろ", sex: "male", memorialDate: "2026-11-01" },
  ]);
});

function issue(name = "トークン", userId = "user-1") {
  return createApiToken(
    userId,
    { name, expiration: "7d" },
    DEFAULT_PERMISSIONS,
  );
}

describe("createApiToken", () => {
  it("トークンのハッシュだけを保存し、トークンから範囲を求められる", async () => {
    const { id, token, expiresAt } = await issue();

    const [row] = await db.select().from(apiTokens);
    expect(JSON.stringify(row)).not.toContain(token);
    expect(await findApiTokenAccess(token)).toEqual({
      id,
      userId: "user-1",
      // DB には秒の単位で保存する
      expiresAt: new Date(
        Math.floor((expiresAt as Date).getTime() / 1000) * 1000,
      ),
      permissions: DEFAULT_PERMISSIONS,
    });
    expect(await findApiTokenAccess(`${token}x`)).toBeNull();
  });

  it("メモリーへ移している猫の書き込みの許可は保存しない", async () => {
    const { id } = await createApiToken(
      "user-1",
      { name: "トークン", expiration: "none" },
      {
        ...DEFAULT_PERMISSIONS,
        writableRecordTypes: { "cat-1": ["poop"], "cat-2": ["poop"] },
      },
    );
    const token = await getApiTokenForUser("user-1", id);
    expect(token?.permissions.writableRecordTypes).toEqual({
      "cat-1": ["poop"],
    });
  });
});

describe("updateApiTokenPermissions", () => {
  const permissions = {
    ...DEFAULT_PERMISSIONS,
    writableRecordTypes: { "cat-1": ["memo" as const] },
  };

  it("許可する範囲を変える", async () => {
    const { id, token } = await issue();
    expect(await updateApiTokenPermissions("user-1", id, permissions)).toBe(
      true,
    );
    expect((await findApiTokenAccess(token))?.permissions).toEqual(permissions);
  });

  it("ほかのユーザーのトークンは変えない", async () => {
    const { id, token } = await issue();
    expect(await updateApiTokenPermissions("user-2", id, permissions)).toBe(
      false,
    );
    expect((await findApiTokenAccess(token))?.permissions).toEqual(
      DEFAULT_PERMISSIONS,
    );
  });
});

describe("アクセス履歴", () => {
  it("トークンごとの最も新しい履歴の日時を、最後に使った日時にする", async () => {
    const first = await issue("使ったトークン");
    await issue("使っていないトークン");
    await issue("ほかのユーザーのトークン", "user-2");
    await recordApiAccess(first.id, ACCESS, new Date("2026-11-20T00:00:00Z"));
    await recordApiAccess(first.id, ACCESS, new Date("2026-11-22T00:00:00Z"));
    await recordApiAccess(first.id, ACCESS, new Date("2026-11-21T00:00:00Z"));

    const tokens = await listApiTokensForUser("user-1");
    expect(tokens.map(({ name, lastUsedAt }) => [name, lastUsedAt])).toEqual([
      ["使っていないトークン", null],
      ["使ったトークン", new Date("2026-11-22T00:00:00Z")],
    ]);
    expect((await getApiTokenForUser("user-1", first.id))?.lastUsedAt).toEqual(
      new Date("2026-11-22T00:00:00Z"),
    );
    expect(await getApiTokenForUser("user-2", first.id)).toBeNull();
  });

  it("IP アドレスと User-Agent を残し、長すぎる値は切り詰める", async () => {
    const { id } = await issue();
    await recordApiAccess(
      id,
      {
        ...ACCESS,
        path: `/api/v1/${"a".repeat(600)}`,
        userAgent: "b".repeat(600),
      },
      new Date(),
    );
    const [log] = await db.select().from(apiAccessLogs);
    expect(log).toMatchObject({
      apiTokenId: id,
      method: "GET",
      status: 200,
      ipAddress: "192.0.2.1",
    });
    expect(log.path).toHaveLength(512);
    expect(log.userAgent).toHaveLength(512);
  });

  it("削除されたトークンの履歴は追加しない", async () => {
    const { id } = await issue();
    await deleteApiToken("user-1", id);
    await recordApiAccess(id, ACCESS, new Date());
    expect(await db.select().from(apiAccessLogs)).toEqual([]);
  });
});

describe("deleteApiToken", () => {
  it("トークンと、そのアクセス履歴だけを削除する", async () => {
    const deleted = await issue("削除する");
    const kept = await issue("残す");
    await recordApiAccess(deleted.id, ACCESS, new Date());
    await recordApiAccess(kept.id, ACCESS, new Date());

    expect(await deleteApiToken("user-1", deleted.id)).toBe(true);

    expect(await findApiTokenAccess(deleted.token)).toBeNull();
    expect(
      (await db.select().from(apiAccessLogs)).map((log) => log.apiTokenId),
    ).toEqual([kept.id]);
  });

  it("ほかのユーザーのトークンと履歴は削除しない", async () => {
    const { id, token } = await issue();
    await recordApiAccess(id, ACCESS, new Date());

    expect(await deleteApiToken("user-2", id)).toBe(false);

    expect(await findApiTokenAccess(token)).not.toBeNull();
    expect(await db.select().from(apiAccessLogs)).toHaveLength(1);
  });
});
