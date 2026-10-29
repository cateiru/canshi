// @vitest-environment node
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { cats, householdMembers, households, users } from "@/db/schema";
import type { McpProps } from "./props";

// `./tools/tools.test.ts` と同様に、`getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const { createCanshiMcpHandler } = await import("./agent");
const canshiMcpHandler = createCanshiMcpHandler("/mcp");

const env = { DB: {} as D1Database } as Env;

beforeEach(async () => {
  const SQL = await initSqlJs();
  const raw = drizzle(new SQL.Database());
  await migrate(raw, { migrationsFolder: "./drizzle" });
  db = raw as unknown as ReturnType<typeof getDb>;

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
    { id: "cat-1", name: "たま", sex: "female", householdId: "house-1" },
    { id: "cat-2", name: "くろ", sex: "male", householdId: "house-2" },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

/** `/mcp` へのリクエストと、その応答 */
type Exchange = { request: Request; response: Response };

/**
 * `canshiMcpHandler` に直接つなぐ MCP のクライアント。`OAuthProvider` と
 * `withMcpClientId` の代わりに、リクエストごとに `getProps()` の値を `ctx.props` に入れる
 */
async function connect(
  getProps: () => McpProps,
  versionNegotiation: "legacy" | "auto",
) {
  const exchanges: Exchange[] = [];
  const transport = new StreamableHTTPClientTransport(
    new URL("https://canshi.test/mcp"),
    {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const ctx = {
          props: getProps(),
          waitUntil: () => {},
          passThroughOnException: () => {},
        } as unknown as ExecutionContext;
        const response = await canshiMcpHandler.fetch(
          request.clone() as Parameters<typeof canshiMcpHandler.fetch>[0],
          env,
          ctx,
        );
        exchanges.push({ request, response: response.clone() });
        return response;
      },
    },
  );
  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { versionNegotiation: { mode: versionNegotiation } },
  );
  await client.connect(transport);
  return { client, exchanges };
}

/** `list_cats` の結果の猫の名前 */
async function listCatNames(client: Client) {
  const result = await client.callTool({ name: "list_cats", arguments: {} });
  const content = result.content as { type: "text"; text: string }[];
  const value = JSON.parse(content[0].text) as { cats: { name: string }[] };
  return value.cats.map(({ name }) => name);
}

/** 応答の JSON-RPC のメッセージ（JSON・SSE のどちらの応答でも読む） */
async function readMessage(response: Response) {
  const text = await response.text();
  const data = response.headers
    .get("content-type")
    ?.includes("text/event-stream")
    ? text
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
        .join("")
    : text;
  return JSON.parse(data) as { result?: Record<string, unknown> };
}

async function findExchange(exchanges: Exchange[], method: string) {
  for (const exchange of exchanges) {
    const body = (await exchange.request
      .clone()
      .json()
      .catch(() => null)) as {
      method?: string;
    } | null;
    if (body?.method === method) {
      return exchange;
    }
  }
  throw new Error(`${method} のリクエストがありません`);
}

const user1 = (): McpProps => ({ userId: "user-1", clientId: "client-1" });

describe("canshiMcpHandler", () => {
  it("2026-07-28 版のクライアントには server/discover で版を伝え、セッションを持たずに応答する", async () => {
    const { client, exchanges } = await connect(user1, "auto");

    expect(client.getProtocolEra()).toBe("modern");
    expect(client.getNegotiatedProtocolVersion()).toBe("2026-07-28");
    await findExchange(exchanges, "server/discover");
    await expect(findExchange(exchanges, "initialize")).rejects.toThrow();
    for (const { response } of exchanges) {
      expect(response.headers.get("mcp-session-id")).toBeNull();
    }
  });

  it("2026-07-28 版の tools/list の結果には resultType とキャッシュの指定（キャッシュしない）を付ける", async () => {
    const { client, exchanges } = await connect(user1, "auto");

    const { tools } = await client.listTools();
    expect(tools.map(({ name }) => name)).toContain("list_cats");

    const { response } = await findExchange(exchanges, "tools/list");
    const { result } = await readMessage(response);
    expect(result).toMatchObject({
      resultType: "complete",
      ttlMs: 0,
      cacheScope: "private",
    });
  });

  it("2026-07-28 版のクライアントからツールを呼べ、結果には resultType とサーバーの情報を付ける", async () => {
    const { client, exchanges } = await connect(user1, "auto");

    expect(await listCatNames(client)).toEqual(["たま"]);

    const { response } = await findExchange(exchanges, "tools/call");
    const { result } = await readMessage(response);
    expect(result).toMatchObject({
      resultType: "complete",
      _meta: {
        "io.modelcontextprotocol/serverInfo": { name: "CANSHI MCP Server" },
      },
    });
  });

  it("initialize で始める以前の版のクライアントにも、セッションを持たずに応答する", async () => {
    const { client, exchanges } = await connect(user1, "legacy");

    expect(client.getProtocolEra()).toBe("legacy");
    expect(await listCatNames(client)).toEqual(["たま"]);
    for (const { response } of exchanges) {
      expect(response.headers.get("mcp-session-id")).toBeNull();
    }
  });

  it("ユーザー・接続はリクエストごとの props から求める", async () => {
    let props = user1();
    const { client } = await connect(() => props, "auto");
    expect(await listCatNames(client)).toEqual(["たま"]);

    props = { userId: "user-2", clientId: "client-2" };
    expect(await listCatNames(client)).toEqual(["くろ"]);

    props = { userId: "user-2" };
    const result = await client.callTool({ name: "list_cats", arguments: {} });
    expect(result.isError).toBe(true);
  });
});
