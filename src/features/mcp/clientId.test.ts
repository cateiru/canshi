// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { mcpConnectionUsages, users } from "@/db/schema";
import { resolveClientId, withMcpClientId } from "./clientId";
import { D1KvStore } from "./d1KvStore";

// `src/features/auth/sessions.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const d1 = {} as D1Database;
const env = { DB: d1 } as Env;

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
  await db.insert(users).values({ id: "user-1", name: "ユーザー1" });
  // `@cloudflare/workers-oauth-provider`（0.10.4）が保存するのと同じキー・形式の grant
  await new D1KvStore(d1).put(
    "grant:user-1:grant-1",
    JSON.stringify({
      id: "grant-1",
      clientId: "client-1",
      userId: "user-1",
      scope: [],
      metadata: {},
      encryptedProps: "encrypted",
      createdAt: 1,
    }),
  );
});

function request(authorization?: string) {
  return new Request("https://canshi.test/mcp", {
    method: "POST",
    headers: authorization ? { Authorization: authorization } : {},
  });
}

describe("resolveClientId", () => {
  it("アクセストークンの grant のクライアントの ID を返す", async () => {
    expect(
      await resolveClientId(
        request("Bearer user-1:grant-1:secret"),
        "user-1",
        d1,
      ),
    ).toBe("client-1");
  });

  it("トークンが無い・形式が違う・別のユーザーのもの・grant が無い場合は null", async () => {
    for (const authorization of [
      undefined,
      "Basic abc",
      "Bearer user-1:grant-1",
      "Bearer user-2:grant-1:secret",
      "Bearer user-1:missing:secret",
      "Bearer user-1:grant-1:secret:extra",
    ]) {
      expect(await resolveClientId(request(authorization), "user-1", d1)).toBe(
        null,
      );
    }
  });
});

describe("withMcpClientId", () => {
  function setup() {
    const apiHandler = {
      fetch: vi.fn(
        async (_request: Request, _env: Env, _ctx: ExecutionContext) =>
          new Response("ok"),
      ),
    };
    const handler = withMcpClientId(apiHandler);
    const waitUntil: Promise<unknown>[] = [];
    const fetch = (req: Request, props: Record<string, unknown>) => {
      const ctx = {
        props,
        waitUntil: (promise: Promise<unknown>) => waitUntil.push(promise),
      } as unknown as ExecutionContext;
      return (
        handler.fetch as unknown as (
          request: Request,
          env: Env,
          ctx: ExecutionContext,
        ) => Promise<Response>
      )(req, env, ctx);
    };
    const propsPassed = () =>
      (apiHandler.fetch.mock.calls[0][2] as unknown as { props: unknown })
        .props;
    const settled = () => Promise.all(waitUntil);
    return { fetch, propsPassed, settled };
  }

  it("アクセストークンのクライアントの ID を props に入れて渡す", async () => {
    const { fetch, propsPassed } = setup();

    const response = await fetch(request("Bearer user-1:grant-1:secret"), {
      userId: "user-1",
    });

    expect(await response.text()).toBe("ok");
    expect(propsPassed()).toEqual({ userId: "user-1", clientId: "client-1" });
  });

  it("求められなければ、トークンの props にクライアントの ID があっても使わない", async () => {
    const { fetch, propsPassed } = setup();

    await fetch(request("Bearer user-1:missing:secret"), {
      userId: "user-1",
      clientId: "spoofed",
    });

    expect(propsPassed()).toEqual({ userId: "user-1" });
  });

  it("接続を使った日時を記録する", async () => {
    const { fetch, settled } = setup();

    await fetch(request("Bearer user-1:grant-1:secret"), { userId: "user-1" });
    await settled();

    expect(await db.select().from(mcpConnectionUsages)).toEqual([
      { userId: "user-1", clientId: "client-1", lastUsedAt: expect.any(Date) },
    ]);
  });

  it("接続を求められなければ、使った日時を記録しない", async () => {
    const { fetch, settled } = setup();

    await fetch(request("Bearer user-1:missing:secret"), { userId: "user-1" });
    await settled();

    expect(await db.select().from(mcpConnectionUsages)).toEqual([]);
  });
});
