// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  apiAccessLogs,
  apiTokens,
  cats,
  householdMembers,
  households,
  poopRecords,
  recordChangeLogs,
  users,
} from "@/db/schema";
import {
  type AccessPermissions,
  DEFAULT_PERMISSIONS,
} from "@/features/external-access/domain/permissionRules";
import { createApiToken } from "../application/mutations";
import type { ApiTokenExpiration } from "../domain/apiToken";
import { handleApiRequest } from "./handler";

let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const env = { DB: {}, MEDIA_BUCKET: {} } as Pick<Env, "DB" | "MEDIA_BUCKET">;

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
  await db.insert(households).values([
    { id: "house-1", name: "家1" },
    { id: "house-2", name: "ほかの人の家" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "house-1", userId: "user-1", role: "owner" },
    { householdId: "house-2", userId: "user-2", role: "owner" },
  ]);
  await db.insert(cats).values([
    { id: "cat-1", name: "たま", sex: "female", householdId: "house-1" },
    {
      id: "cat-2",
      name: "みけ",
      sex: "female",
      householdId: "house-1",
      memorialDate: "2026-11-01",
    },
    { id: "cat-3", name: "くろ", sex: "male", householdId: "house-2" },
  ]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function issue(
  permissions: Partial<AccessPermissions> = {},
  expiration: ApiTokenExpiration = "30d",
) {
  return createApiToken(
    "user-1",
    { name: "トークン", expiration },
    { ...DEFAULT_PERMISSIONS, ...permissions },
  );
}

type CallOptions = {
  token?: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

/** API を呼び、応答のステータス・ヘッダー・本文の JSON を返す。応答の後の処理も終わらせる */
async function call(path: string, options: CallOptions = {}) {
  const { token, method = "GET", body, headers } = options;
  const tasks: (() => Promise<void>)[] = [];
  const response = await handleApiRequest(
    new Request(`https://canshi.test/api/v1${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : typeof body === "string"
            ? body
            : JSON.stringify(body),
    }),
    { env, defer: (task) => tasks.push(task) },
  );
  for (const task of tasks) {
    await task();
  }
  return {
    status: response.status,
    headers: response.headers,
    json: (await response.json()) as Record<string, unknown> & {
      error?: { code: string; message: string };
    },
  };
}

describe("認証", () => {
  it("トークンが無い・正しくないリクエストは 401 にし、履歴に残さない", async () => {
    for (const token of [undefined, "canshi_unknown"]) {
      const result = await call("/cats", { token });
      expect(result.status).toBe(401);
      expect(result.json.error?.code).toBe("unauthorized");
      expect(result.headers.get("WWW-Authenticate")).toBe("Bearer");
    }
    expect(await db.select().from(apiAccessLogs)).toEqual([]);
  });

  it("期限が切れたトークンは 401 にする", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T00:00:00Z"));
    const { token } = await issue({}, "1d");
    vi.setSystemTime(new Date("2026-11-24T23:59:59Z"));
    expect((await call("/cats", { token })).status).toBe(200);

    vi.setSystemTime(new Date("2026-11-25T00:00:00Z"));
    const result = await call("/cats", { token });
    expect(result.status).toBe(401);
    expect(result.json.error?.message).toContain("有効期限が切れています");
  });

  it("期限なしのトークンは使い続けられる", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-24T00:00:00Z"));
    const { token } = await issue({}, "none");
    vi.setSystemTime(new Date("2036-11-24T00:00:00Z"));
    expect((await call("/cats", { token })).status).toBe(200);
  });
});

describe("読み取り", () => {
  it("トークンを発行したユーザーの家の猫だけを返す", async () => {
    const { token } = await issue();
    const result = await call("/cats", { token });
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    expect(
      (result.json.cats as { id: string }[]).map(({ id }) => id).sort(),
    ).toEqual(["cat-1", "cat-2"]);

    expect((await call("/cats/cat-3", { token })).status).toBe(404);
  });

  it("読み取りを許可していない猫は、存在しない猫と区別しない", async () => {
    const { token } = await issue({ excludedCatIds: ["cat-1"] });
    const result = await call("/cats/cat-1", { token });
    expect(result.status).toBe(404);
    expect(result.json.error).toEqual({
      code: "not_found",
      message: 'catId="cat-1" の猫が見つかりません',
    });
  });

  it("範囲を変えると、次のリクエストから反映する", async () => {
    const { token } = await issue();
    expect((await call("/cats/cat-1", { token })).status).toBe(200);
    await db.update(apiTokens).set({ excludedCatIds: ["cat-1"] });
    expect((await call("/cats/cat-1", { token })).status).toBe(404);
  });

  it("クエリの数値を読み取る", async () => {
    const { token } = await issue();
    expect(
      (await call("/cats/cat-1/timeline?year=2026&month=11", { token })).json,
    ).toEqual({ entries: [], hasMore: false });

    const invalid = await call("/cats/cat-1/timeline?year=2026&month=13", {
      token,
    });
    expect(invalid.status).toBe(400);
    expect(invalid.json.error?.message).toContain("month");
  });

  it("知らないクエリや、パスの引数のクエリでの指定は受け付けない", async () => {
    const { token } = await issue();
    for (const query of ["unknown=1", "catId=cat-2"]) {
      const result = await call(
        `/cats/cat-1/timeline?year=2026&month=11&${query}`,
        { token },
      );
      expect(result.status).toBe(400);
    }
  });
});

describe("書き込み", () => {
  it("書き込みを許可した記録を追加・編集し、履歴にユーザーとトークンを残す", async () => {
    const { id: tokenId, token } = await issue({
      writableRecordTypes: { "cat-1": ["poop"] },
    });
    const created = await call("/cats/cat-1/poop-records", {
      token,
      method: "POST",
      body: { consistency: "soft" },
    });
    expect(created.status).toBe(201);
    const { id } = created.json as { id: string };

    const updated = await call(`/cats/cat-1/poop-records/${id}`, {
      token,
      method: "PATCH",
      body: { memo: "編集" },
    });
    expect(updated.status).toBe(200);

    const [record] = await db.select().from(poopRecords);
    expect(record).toMatchObject({ id, consistency: "soft", memo: "編集" });
    expect(await db.select().from(recordChangeLogs)).toEqual(
      expect.arrayContaining(
        ["create", "update"].map((action) =>
          expect.objectContaining({
            recordId: id,
            action,
            userId: "user-1",
            mcpClientId: null,
            apiTokenId: tokenId,
          }),
        ),
      ),
    );
  });

  it("書き込みを許可していない記録は 403 にする", async () => {
    const { token } = await issue();
    const result = await call("/cats/cat-1/poop-records", {
      token,
      method: "POST",
      body: { consistency: "soft" },
    });
    expect(result.status).toBe(403);
    expect(result.json.error?.message).toContain("このトークンには");
    expect(result.json.error?.message).toContain("「APIトークン」");
    expect(await db.select().from(poopRecords)).toEqual([]);
  });

  it("メモリーへ移した猫の記録は 409 にする", async () => {
    const { token } = await issue();
    const result = await call("/cats/cat-2/poop-records", {
      token,
      method: "POST",
      body: { consistency: "soft" },
    });
    expect(result.status).toBe(409);
  });

  it("家ごとの操作は、許可したものだけを行える", async () => {
    const { token } = await issue({
      householdOperations: { "house-1": ["household:update"] },
    });
    const renamed = await call("/households/house-1", {
      token,
      method: "PATCH",
      body: { name: "新しい名前" },
    });
    expect(renamed.status).toBe(200);
    expect((await call("/households/house-1/members", { token })).status).toBe(
      403,
    );
  });

  it("共通のごはん商品は、管理者のトークンだけが扱える", async () => {
    const { token } = await issue({
      catalogOperations: ["catalogFoodProduct:read"],
    });
    expect((await call("/catalog-food-products", { token })).status).toBe(403);

    await db.update(users).set({ role: "admin" });
    expect((await call("/catalog-food-products", { token })).status).toBe(200);
  });

  it("招待 URL は、リクエストのオリジンで返す", async () => {
    const { token } = await issue({
      householdOperations: { "house-1": ["householdInvitation:create"] },
    });
    const result = await call("/households/house-1/invitations", {
      token,
      method: "POST",
    });
    expect(result.status).toBe(201);
    expect(result.json.url).toMatch(/^https:\/\/canshi\.test\/invitations\//);
  });
});

describe("リクエストの誤り", () => {
  it.each(["[]", "null", "{"])(
    "JSON のオブジェクトでない本文（%s）は 400 にする",
    async (body) => {
      const { token } = await issue({
        writableRecordTypes: { "cat-1": ["poop"] },
      });
      const result = await call("/cats/cat-1/poop-records", {
        token,
        method: "POST",
        body,
      });
      expect(result.status).toBe(400);
    },
  );

  it("知らない項目・正しくない項目は 400 にする", async () => {
    const { token } = await issue({
      writableRecordTypes: { "cat-1": ["poop"] },
    });
    for (const body of [
      { consistency: "soft", unknown: 1 },
      { consistency: "soft", catId: "cat-2" },
      { consistency: "invalid" },
      { consistency: "soft", memo: "あ".repeat(501) },
    ]) {
      const result = await call("/cats/cat-1/poop-records", {
        token,
        method: "POST",
        body,
      });
      expect(result.status).toBe(400);
      expect(result.json.error?.code).toBe("invalid_request");
    }
    expect(await db.select().from(poopRecords)).toEqual([]);
  });

  it("大きすぎる本文は 413 にする", async () => {
    const { token } = await issue();
    const declared = await call("/cats/cat-1/poop-records", {
      token,
      method: "POST",
      body: { consistency: "soft" },
      headers: { "Content-Length": "100000000" },
    });
    expect(declared.status).toBe(413);

    const actual = await call("/cats/cat-1/poop-records", {
      token,
      method: "POST",
      body: `{"memo":"${"a".repeat(16 * 1024 * 1024)}"}`,
    });
    expect(actual.status).toBe(413);
  });

  it("存在しないパスは 404、使えないメソッドは 405 にする", async () => {
    const { token } = await issue();
    expect((await call("/unknown", { token })).status).toBe(404);

    const result = await call("/cats/cat-1", { token, method: "DELETE" });
    expect(result.status).toBe(405);
    expect(result.headers.get("Allow")).toBe("GET, PATCH");
  });

  it("エラーのメッセージの操作の名前は、エンドポイントに置き換える", async () => {
    const { token } = await issue({
      writableRecordTypes: { "cat-1": ["cleaning"] },
    });
    const result = await call("/cats/cat-1/cleaning-records", {
      token,
      method: "POST",
      body: { cleaningTargetId: "missing" },
    });
    expect(result.status).toBe(404);
    expect(result.json.error?.message).toContain(
      "GET /cats/{catId}/cleaning-targets",
    );
  });
});

describe("アクセス履歴", () => {
  it("認証できたリクエストの、応答のステータス・IP アドレス・User-Agent を残す", async () => {
    const { id, token } = await issue();
    const headers = {
      "CF-Connecting-IP": "192.0.2.1",
      "User-Agent": "test-client/1.0",
    };
    await call("/cats?unknown=secret", { token, headers });
    await call("/cats", { token, headers });
    await call("/unknown", { token, headers });

    const logs = await db.select().from(apiAccessLogs);
    expect(
      logs.map(({ method, path, status }) => [method, path, status]),
    ).toEqual([
      ["GET", "/api/v1/cats", 400],
      ["GET", "/api/v1/cats", 200],
      ["GET", "/api/v1/unknown", 404],
    ]);
    for (const log of logs) {
      expect(log).toMatchObject({
        apiTokenId: id,
        ipAddress: "192.0.2.1",
        userAgent: "test-client/1.0",
      });
    }
  });

  it("想定外のエラーは 500 にし、内容を返さずに履歴に残す", async () => {
    const { token } = await issue();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi
      .spyOn(
        await import("@/features/households/infrastructure/queries"),
        "listCatsForUser",
      )
      .mockRejectedValue(new Error("DB の内部のエラー"));
    const result = await call("/cats", { token });
    failing.mockRestore();

    expect(result.status).toBe(500);
    expect(JSON.stringify(result.json)).not.toContain("DB の内部のエラー");
    expect((await db.select().from(apiAccessLogs))[0].status).toBe(500);
  });
});
