// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { mcpConnectionUsages, mcpPermissions, users } from "@/db/schema";
import {
  getGrantClientId,
  getUserMcpConnection,
  listUserMcpConnections,
  revokeUserMcpConnection,
} from "./connections";
import { D1KvStore } from "./d1KvStore";

// `src/features/auth/sessions.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const d1 = {} as D1Database;
const NOW = new Date("2026-10-12T00:00:00Z");
const NOW_SECONDS = NOW.getTime() / 1000;

beforeEach(async () => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  const SQL = await initSqlJs();
  db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * `@cloudflare/workers-oauth-provider`（0.10.4）の `completeAuthorization()` が保存するのと
 * 同じキー・形式で、クライアント・grant・アクセストークンを保存する
 */
async function seed() {
  const store = new D1KvStore(d1);
  await store.put(
    "client:client-chatgpt",
    JSON.stringify({
      clientId: "client-chatgpt",
      clientName: "ChatGPT",
      clientSecret: "secret-hash",
      redirectUris: ["https://chatgpt.com/connector/oauth/callback"],
    }),
  );
  await store.put(
    "client:client-noname",
    JSON.stringify({ clientId: "client-noname", redirectUris: [] }),
  );
  const grants = [
    {
      key: "grant:user-1:grant_old-1",
      value: {
        id: "grant_old-1",
        clientId: "client-chatgpt",
        userId: "user-1",
        scope: [],
        metadata: {},
        encryptedProps: "encrypted",
        createdAt: NOW_SECONDS - 3600,
        redirectUri: "https://chatgpt.com/connector/oauth/callback",
        refreshTokenId: "refresh-hash",
      },
    },
    {
      key: "grant:user-1:grantNew2",
      value: {
        id: "grantNew2",
        clientId: "client-noname",
        userId: "user-1",
        scope: [],
        metadata: {},
        encryptedProps: "encrypted",
        createdAt: NOW_SECONDS - 60,
      },
    },
    {
      key: "grant:user-1:grantExpired",
      value: {
        id: "grantExpired",
        clientId: "client-chatgpt",
        userId: "user-1",
        scope: [],
        metadata: {},
        encryptedProps: "encrypted",
        createdAt: NOW_SECONDS - 7200,
        expiresAt: NOW_SECONDS - 1,
      },
    },
    {
      key: "grant:user-2:grantOther",
      value: {
        id: "grantOther",
        clientId: "client-chatgpt",
        userId: "user-2",
        scope: [],
        metadata: {},
        encryptedProps: "encrypted",
        createdAt: NOW_SECONDS,
      },
    },
  ];
  for (const { key, value } of grants) {
    await store.put(key, JSON.stringify(value));
  }
  for (const key of [
    "token:user-1:grant_old-1:token-a",
    "token:user-1:grant_old-1:token-b",
    "token:user-1:grantNew2:token-c",
    "token:user-2:grantOther:token-d",
  ]) {
    await store.put(key, JSON.stringify({ id: key }), { expirationTtl: 3600 });
  }
  return store;
}

describe("listUserMcpConnections", () => {
  it("ユーザーの期限内の接続を新しい順に、クライアントの名前と合わせて返す", async () => {
    await seed();

    expect(await listUserMcpConnections("user-1", d1)).toEqual([
      {
        id: "grantNew2",
        clientId: "client-noname",
        clientName: null,
        redirectUri: null,
        createdAt: new Date(NOW.getTime() - 60 * 1000),
        lastUsedAt: null,
      },
      {
        id: "grant_old-1",
        clientId: "client-chatgpt",
        clientName: "ChatGPT",
        redirectUri: "https://chatgpt.com/connector/oauth/callback",
        createdAt: new Date(NOW.getTime() - 3600 * 1000),
        lastUsedAt: null,
      },
    ]);
  });

  it("接続を最後に使った日時を、接続した日時より前のものを除いて返す", async () => {
    await seed();
    await db.insert(users).values([
      { id: "user-1", name: "ユーザー1" },
      { id: "user-2", name: "ユーザー2" },
    ]);
    await db.insert(mcpConnectionUsages).values([
      {
        userId: "user-1",
        clientId: "client-chatgpt",
        lastUsedAt: new Date(NOW.getTime() - 600 * 1000),
      },
      // もう一度同意する前の接続の日時（接続した日時より前）は表示しない
      {
        userId: "user-1",
        clientId: "client-noname",
        lastUsedAt: new Date(NOW.getTime() - 120 * 1000),
      },
      // ほかのユーザーの日時は使わない
      {
        userId: "user-2",
        clientId: "client-noname",
        lastUsedAt: NOW,
      },
    ]);

    expect(
      (await listUserMcpConnections("user-1", d1)).map(
        ({ id, lastUsedAt }) => ({ id, lastUsedAt }),
      ),
    ).toEqual([
      { id: "grantNew2", lastUsedAt: null },
      {
        id: "grant_old-1",
        lastUsedAt: new Date(NOW.getTime() - 600 * 1000),
      },
    ]);
  });

  it("接続が無ければ空の配列を返す", async () => {
    await seed();

    expect(await listUserMcpConnections("user-3", d1)).toEqual([]);
  });
});

describe("getUserMcpConnection", () => {
  it("ユーザーの期限内の接続だけを返す", async () => {
    await seed();

    expect(await getUserMcpConnection("user-1", "grant_old-1", d1)).toEqual(
      expect.objectContaining({
        id: "grant_old-1",
        clientId: "client-chatgpt",
      }),
    );
    expect(await getUserMcpConnection("user-1", "grantExpired", d1)).toBeNull();
    expect(await getUserMcpConnection("user-1", "grantOther", d1)).toBeNull();
    expect(await getUserMcpConnection("user-1", "missing", d1)).toBeNull();
  });
});

describe("getGrantClientId", () => {
  it("ユーザーの grant のクライアントの ID を返し、無い・キーの区切りを含む ID なら null", async () => {
    await seed();

    expect(await getGrantClientId("user-1", "grant_old-1", d1)).toBe(
      "client-chatgpt",
    );
    expect(await getGrantClientId("user-1", "grantOther", d1)).toBeNull();
    expect(
      await getGrantClientId("user-1", "grantNew2:token-c", d1),
    ).toBeNull();
  });
});

describe("revokeUserMcpConnection", () => {
  it("接続の grant とアクセストークンだけを削除する", async () => {
    const store = await seed();

    expect(await revokeUserMcpConnection("user-1", "grant_old-1", d1)).toBe(
      true,
    );

    expect(await store.get("grant:user-1:grant_old-1")).toBeNull();
    expect(await store.get("token:user-1:grant_old-1:token-a")).toBeNull();
    expect(await store.get("token:user-1:grant_old-1:token-b")).toBeNull();
    // ほかの接続・ほかのユーザーの接続・クライアントの登録は残す
    expect(await store.get("grant:user-1:grantNew2")).not.toBeNull();
    expect(await store.get("token:user-1:grantNew2:token-c")).not.toBeNull();
    expect(await store.get("grant:user-2:grantOther")).not.toBeNull();
    expect(await store.get("client:client-chatgpt")).not.toBeNull();
    expect(
      (await listUserMcpConnections("user-1", d1)).map(({ id }) => id),
    ).toEqual(["grantNew2"]);
  });

  it("解除した接続の読み取りの範囲だけを削除する", async () => {
    await seed();
    await db.insert(users).values([
      { id: "user-1", name: "ユーザー1" },
      { id: "user-2", name: "ユーザー2" },
    ]);
    await db.insert(mcpPermissions).values([
      { userId: "user-1", clientId: "client-chatgpt", excludedCatIds: ["c"] },
      { userId: "user-1", clientId: "client-noname", excludedCatIds: ["c"] },
      { userId: "user-2", clientId: "client-chatgpt", excludedCatIds: ["c"] },
    ]);

    await revokeUserMcpConnection("user-1", "grant_old-1", d1);

    expect(
      (await db.select().from(mcpPermissions)).map(({ userId, clientId }) => ({
        userId,
        clientId,
      })),
    ).toEqual([
      { userId: "user-1", clientId: "client-noname" },
      { userId: "user-2", clientId: "client-chatgpt" },
    ]);
  });

  it("解除した接続を最後に使った日時の記録だけを削除する", async () => {
    await seed();
    await db.insert(users).values([
      { id: "user-1", name: "ユーザー1" },
      { id: "user-2", name: "ユーザー2" },
    ]);
    await db.insert(mcpConnectionUsages).values([
      { userId: "user-1", clientId: "client-chatgpt", lastUsedAt: NOW },
      { userId: "user-1", clientId: "client-noname", lastUsedAt: NOW },
      { userId: "user-2", clientId: "client-chatgpt", lastUsedAt: NOW },
    ]);

    await revokeUserMcpConnection("user-1", "grant_old-1", d1);

    expect(
      (await db.select().from(mcpConnectionUsages)).map(
        ({ userId, clientId }) => ({ userId, clientId }),
      ),
    ).toEqual([
      { userId: "user-1", clientId: "client-noname" },
      { userId: "user-2", clientId: "client-chatgpt" },
    ]);
  });

  it("解除した後は、トークンの更新と重なっても grant・トークンが書き戻されない", async () => {
    const store = await seed();
    // 解除の前にトークンの更新が grant を読んでいた場合の書き戻しを再現する
    const grantBeforeRevoke = await store.get("grant:user-1:grant_old-1");

    await revokeUserMcpConnection("user-1", "grant_old-1", d1);
    await store.put("grant:user-1:grant_old-1", grantBeforeRevoke as string);
    await store.put("token:user-1:grant_old-1:token-new", "{}", {
      expirationTtl: 3600,
    });

    expect(await store.get("grant:user-1:grant_old-1")).toBeNull();
    expect(await store.get("token:user-1:grant_old-1:token-new")).toBeNull();
    expect(
      (await listUserMcpConnections("user-1", d1)).map(({ id }) => id),
    ).toEqual(["grantNew2"]);
    // ほかの接続のトークンは引き続き書き込める
    await store.put("token:user-1:grantNew2:token-new", "{}");
    expect(await store.get("token:user-1:grantNew2:token-new")).toBe("{}");
  });

  it("別のユーザーの接続は解除できない", async () => {
    const store = await seed();

    expect(await revokeUserMcpConnection("user-1", "grantOther", d1)).toBe(
      false,
    );

    expect(await store.get("grant:user-2:grantOther")).not.toBeNull();
    expect(await store.get("token:user-2:grantOther:token-d")).not.toBeNull();
  });

  it("存在しない ID や、キーの区切りを含む ID は何も削除しない", async () => {
    const store = await seed();

    expect(await revokeUserMcpConnection("user-1", "missing", d1)).toBe(false);
    expect(await revokeUserMcpConnection("user-2:grantOther", "x", d1)).toBe(
      false,
    );
    expect(
      await revokeUserMcpConnection("user-1", "grantNew2:token-c", d1),
    ).toBe(false);

    expect(await store.get("grant:user-1:grantNew2")).not.toBeNull();
    expect(await store.get("token:user-1:grantNew2:token-c")).not.toBeNull();
    expect(await store.get("grant:user-2:grantOther")).not.toBeNull();
  });
});
