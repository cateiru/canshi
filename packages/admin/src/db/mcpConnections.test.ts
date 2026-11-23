import type { Database } from "sql.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createMigratedDatabase, toAdminDb } from "../test/d1";
import { BASE_TIME } from "../test/fixtures";
import type { AdminDb } from "./client";
import { formatRedirectHost, listMcpProviders } from "./mcpConnections";

const NOW = new Date(BASE_TIME * 1000);

let database: Database;
let db: AdminDb;

beforeEach(async () => {
  database = await createMigratedDatabase();
  db = toAdminDb(database);
});

/** `oauth_kv_entries` に、ライブラリと同じキー・形式で行を入れる。`expiresAt` は行の期限（unix 秒） */
function put(key: string, value: unknown, expiresAt: number | null = null) {
  database.run(
    "INSERT INTO oauth_kv_entries (key, value, expires_at) VALUES (?, ?, ?)",
    [key, JSON.stringify(value), expiresAt],
  );
}

function putGrant(
  userId: string,
  grantId: string,
  values: {
    clientId: string;
    redirectUri?: string;
    clientName?: string;
    expiresAt?: number;
  },
  rowExpiresAt: number | null = null,
) {
  put(
    `grant:${userId}:${grantId}`,
    {
      id: grantId,
      clientId: values.clientId,
      userId,
      scope: [],
      metadata: values.clientName ? { clientName: values.clientName } : {},
      encryptedProps: "",
      createdAt: BASE_TIME,
      ...(values.redirectUri ? { redirectUri: values.redirectUri } : {}),
      ...(values.expiresAt ? { expiresAt: values.expiresAt } : {}),
    },
    rowExpiresAt,
  );
}

function putClient(clientId: string, clientName: string) {
  put(`client:${clientId}`, {
    clientId,
    clientName,
    redirectUris: ["https://example.com/callback"],
  });
}

describe("listMcpProviders", () => {
  it("接続が無ければ、アイコンを見分けられるアプリだけを 0 件で並べる", async () => {
    expect(await listMcpProviders(db, NOW)).toEqual([
      {
        app: "openai",
        redirectHost: null,
        connectionCount: 0,
        clientNames: [],
      },
      {
        app: "claude",
        redirectHost: null,
        connectionCount: 0,
        clientNames: [],
      },
      { app: "meta", redirectHost: null, connectionCount: 0, clientNames: [] },
      {
        app: "gemini",
        redirectHost: null,
        connectionCount: 0,
        clientNames: [],
      },
      {
        app: "perplexity",
        redirectHost: null,
        connectionCount: 0,
        clientNames: [],
      },
    ]);
  });

  it("見分けられるアプリはアプリごとに、見分けられない接続は接続先ごとに数える", async () => {
    putClient("chatgpt-client", "ChatGPT");
    putGrant("user-1", "g1", {
      clientId: "chatgpt-client",
      redirectUri: "https://chatgpt.com/connector/oauth/callback",
    });
    putGrant("user-2", "g2", {
      clientId: "chatgpt-client",
      redirectUri: "https://chat.openai.com/aip/callback",
    });
    // CIMD のクライアントは登録が無く、同意したときに grant に残した名前を使う
    putGrant("user-1", "g3", {
      clientId: "https://claude.ai/oauth/mcp-oauth-client-metadata",
      redirectUri: "https://claude.ai/api/mcp/auth_callback",
      clientName: "Claude",
    });
    putClient("agent-a", "Agent A");
    putClient("agent-b", "Agent B");
    putGrant("user-1", "g4", {
      clientId: "agent-b",
      redirectUri: "https://agent.example.com/oauth/callback",
    });
    putGrant("user-2", "g5", {
      clientId: "agent-a",
      redirectUri: "https://agent.example.com/other/callback",
    });
    putGrant("user-3", "g6", {
      clientId: "agent-a",
      redirectUri: "https://agent.example.com/oauth/callback",
    });
    putGrant("user-1", "g7", {
      clientId: "cursor-client",
      redirectUri: "cursor://anysphere.cursor-mcp/oauth/callback",
      clientName: "Cursor",
    });
    // 名前を名乗っていない・渡し先が記録されていない接続
    putGrant("user-2", "g8", { clientId: "unnamed-client" });

    const providers = await listMcpProviders(db, NOW);
    expect(providers).toEqual([
      {
        app: "openai",
        redirectHost: null,
        connectionCount: 2,
        clientNames: ["ChatGPT"],
      },
      {
        app: "claude",
        redirectHost: null,
        connectionCount: 1,
        clientNames: ["Claude"],
      },
      { app: "meta", redirectHost: null, connectionCount: 0, clientNames: [] },
      {
        app: "gemini",
        redirectHost: null,
        connectionCount: 0,
        clientNames: [],
      },
      {
        app: "perplexity",
        redirectHost: null,
        connectionCount: 0,
        clientNames: [],
      },
      // 接続の多い順。同じ数なら接続先の名前順で、接続先の記録が無いものは最後
      {
        app: null,
        redirectHost: "agent.example.com",
        connectionCount: 3,
        clientNames: ["Agent A", "Agent B"],
      },
      {
        app: null,
        redirectHost: "cursor://anysphere.cursor-mcp",
        connectionCount: 1,
        clientNames: ["Cursor"],
      },
      { app: null, redirectHost: null, connectionCount: 1, clientNames: [] },
    ]);
  });

  it("期限切れの grant と、grant 以外の行は数えない", async () => {
    putClient("chatgpt-client", "ChatGPT");
    putGrant("user-1", "active", {
      clientId: "chatgpt-client",
      redirectUri: "https://chatgpt.com/callback",
      expiresAt: BASE_TIME + 1,
    });
    // grant の有効期限が切れている
    putGrant("user-1", "expired", {
      clientId: "chatgpt-client",
      redirectUri: "https://chatgpt.com/callback",
      expiresAt: BASE_TIME,
    });
    // 行の期限が切れている（定期実行でまだ削除されていない）
    putGrant(
      "user-2",
      "expired-row",
      {
        clientId: "chatgpt-client",
        redirectUri: "https://chatgpt.com/callback",
      },
      BASE_TIME,
    );
    put("revoked-grant:user-3:revoked", "1");
    put("token:user-1:active:token-1", { id: "token-1", grantId: "active" });

    const [openai, ...others] = await listMcpProviders(db, NOW);
    expect(openai).toEqual({
      app: "openai",
      redirectHost: null,
      connectionCount: 1,
      clientNames: ["ChatGPT"],
    });
    expect(others.every((provider) => provider.connectionCount === 0)).toBe(
      true,
    );
  });

  it("クライアントが多くても、すべての登録から名前を読む", async () => {
    // D1 のバインドパラメーターの上限に収めるため、クライアントの登録は分けて読む
    for (let i = 0; i < 95; i++) {
      const clientId = `client-${String(i).padStart(3, "0")}`;
      putClient(clientId, `Agent ${String(i).padStart(3, "0")}`);
      putGrant(`user-${i}`, `grant-${i}`, {
        clientId,
        redirectUri: "https://agent.example.com/callback",
      });
    }
    const providers = await listMcpProviders(db, NOW);
    const unknown = providers.find(
      (provider) => provider.redirectHost === "agent.example.com",
    );
    expect(unknown?.connectionCount).toBe(95);
    expect(unknown?.clientNames).toHaveLength(95);
    expect(unknown?.clientNames.at(-1)).toBe("Agent 094");
  });
});

describe("formatRedirectHost", () => {
  it.each([
    ["https://agent.example.com/oauth/callback", "agent.example.com"],
    ["https://agent.example.com:8443/callback", "agent.example.com:8443"],
    ["http://localhost:6274/oauth/callback", "http://localhost:6274"],
    [
      "cursor://anysphere.cursor-mcp/oauth/callback",
      "cursor://anysphere.cursor-mcp",
    ],
    ["myapp:/callback", "myapp:"],
    ["not a url", "not a url"],
  ])("%s は %s にする", (redirectUri, expected) => {
    expect(formatRedirectHost(redirectUri)).toBe(expected);
  });

  it("渡し先が無ければ null を返す", () => {
    expect(formatRedirectHost(undefined)).toBeNull();
  });
});
