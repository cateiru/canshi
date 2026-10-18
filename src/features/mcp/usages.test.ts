// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { users } from "@/db/schema";
import {
  deleteMcpConnectionUsage,
  listMcpConnectionLastUsedAt,
  MCP_CONNECTION_USAGE_INTERVAL_SECONDS,
  recordMcpConnectionUsage,
} from "./usages";

// `src/features/auth/sessions.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const d1 = {} as D1Database;
const NOW = new Date("2026-10-18T00:00:00Z");

function secondsLater(seconds: number) {
  return new Date(NOW.getTime() + seconds * 1000);
}

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
});

describe("recordMcpConnectionUsage", () => {
  it("初めて使った日時を記録する", async () => {
    await recordMcpConnectionUsage("user-1", "client-1", d1, NOW);

    expect(await listMcpConnectionLastUsedAt("user-1", d1)).toEqual(
      new Map([["client-1", NOW]]),
    );
  });

  it("前回の記録から間隔より短い間は更新せず、過ぎたら更新する", async () => {
    await recordMcpConnectionUsage("user-1", "client-1", d1, NOW);

    await recordMcpConnectionUsage(
      "user-1",
      "client-1",
      d1,
      secondsLater(MCP_CONNECTION_USAGE_INTERVAL_SECONDS),
    );
    expect(await listMcpConnectionLastUsedAt("user-1", d1)).toEqual(
      new Map([["client-1", NOW]]),
    );

    await recordMcpConnectionUsage(
      "user-1",
      "client-1",
      d1,
      secondsLater(MCP_CONNECTION_USAGE_INTERVAL_SECONDS + 1),
    );
    expect(await listMcpConnectionLastUsedAt("user-1", d1)).toEqual(
      new Map([
        ["client-1", secondsLater(MCP_CONNECTION_USAGE_INTERVAL_SECONDS + 1)],
      ]),
    );
  });
});

describe("listMcpConnectionLastUsedAt", () => {
  it("ユーザーの接続の日時だけを返す", async () => {
    await recordMcpConnectionUsage("user-1", "client-1", d1, NOW);
    await recordMcpConnectionUsage("user-1", "client-2", d1, secondsLater(10));
    await recordMcpConnectionUsage("user-2", "client-1", d1, secondsLater(20));

    expect(await listMcpConnectionLastUsedAt("user-1", d1)).toEqual(
      new Map([
        ["client-1", NOW],
        ["client-2", secondsLater(10)],
      ]),
    );
  });
});

describe("deleteMcpConnectionUsage", () => {
  it("ユーザーの指定した接続の記録だけを消す", async () => {
    await recordMcpConnectionUsage("user-1", "client-1", d1, NOW);
    await recordMcpConnectionUsage("user-1", "client-2", d1, NOW);
    await recordMcpConnectionUsage("user-2", "client-1", d1, NOW);

    await deleteMcpConnectionUsage("user-1", "client-1", d1);

    expect(await listMcpConnectionLastUsedAt("user-1", d1)).toEqual(
      new Map([["client-2", NOW]]),
    );
    expect(await listMcpConnectionLastUsedAt("user-2", d1)).toEqual(
      new Map([["client-1", NOW]]),
    );
  });
});
