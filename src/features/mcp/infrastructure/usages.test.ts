// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { D1KvStore } from "./d1KvStore";
import {
  deleteMcpConnectionUsage,
  listMcpConnectionLastUsedAt,
  MCP_CONNECTION_USAGE_INTERVAL_SECONDS,
  purgeOrphanedMcpConnectionUsages,
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
  for (const grant of GRANTS) {
    await putGrant(grant);
  }
});

/** テストで使う grant（ユーザー ID・grant の ID） */
const GRANTS = [
  { userId: "user-1", grantId: "grant-1" },
  { userId: "user-1", grantId: "grant-2" },
  { userId: "user-2", grantId: "grant-3" },
];

/**
 * `@cloudflare/workers-oauth-provider`（1.2.4）が保存するのと同じキーで grant を保存する。
 * 記録は grant が残っているかだけを見るため、値は必要な項目だけにする
 */
async function putGrant(
  grant: { userId: string; grantId: string },
  options?: { expiration?: number },
) {
  await new D1KvStore(d1).put(
    `grant:${grant.userId}:${grant.grantId}`,
    JSON.stringify({ id: grant.grantId, clientId: "client-1" }),
    options,
  );
}

/** `GRANTS` の grant で、使った日時を記録する */
function record(grantId: string, now: Date) {
  const grant = GRANTS.find((g) => g.grantId === grantId);
  if (!grant) {
    throw new Error(`unknown grant: ${grantId}`);
  }
  return recordMcpConnectionUsage(grant.userId, grant.grantId, d1, now);
}

describe("recordMcpConnectionUsage", () => {
  it("初めて使った日時を記録する", async () => {
    await record("grant-1", NOW);

    expect(await listMcpConnectionLastUsedAt("user-1", d1)).toEqual(
      new Map([["grant-1", NOW]]),
    );
  });

  it("grant が無い・期限切れの場合は記録しない", async () => {
    await recordMcpConnectionUsage("user-1", "missing", d1, NOW);
    // 別のユーザーの grant では記録しない
    await recordMcpConnectionUsage("user-1", "grant-3", d1, NOW);
    await putGrant(
      { userId: "user-1", grantId: "grant-expired" },
      { expiration: NOW.getTime() / 1000 },
    );
    await recordMcpConnectionUsage("user-1", "grant-expired", d1, NOW);

    expect(await listMcpConnectionLastUsedAt("user-1", d1)).toEqual(new Map());
  });

  it("前回の記録から間隔より短い間は更新せず、過ぎたら更新する", async () => {
    await record("grant-1", NOW);

    await record(
      "grant-1",
      secondsLater(MCP_CONNECTION_USAGE_INTERVAL_SECONDS),
    );
    expect(await listMcpConnectionLastUsedAt("user-1", d1)).toEqual(
      new Map([["grant-1", NOW]]),
    );

    await record(
      "grant-1",
      secondsLater(MCP_CONNECTION_USAGE_INTERVAL_SECONDS + 1),
    );
    expect(await listMcpConnectionLastUsedAt("user-1", d1)).toEqual(
      new Map([
        ["grant-1", secondsLater(MCP_CONNECTION_USAGE_INTERVAL_SECONDS + 1)],
      ]),
    );
  });
});

describe("listMcpConnectionLastUsedAt", () => {
  it("ユーザーの接続の日時だけを返す", async () => {
    await record("grant-1", NOW);
    await record("grant-2", secondsLater(10));
    await record("grant-3", secondsLater(20));

    expect(await listMcpConnectionLastUsedAt("user-1", d1)).toEqual(
      new Map([
        ["grant-1", NOW],
        ["grant-2", secondsLater(10)],
      ]),
    );
  });
});

describe("deleteMcpConnectionUsage", () => {
  it("ユーザーの指定した接続の記録だけを消す", async () => {
    await record("grant-1", NOW);
    await record("grant-2", NOW);
    await record("grant-3", NOW);

    await deleteMcpConnectionUsage("user-1", "grant-1", d1);
    // 別のユーザーの接続の記録は消さない
    await deleteMcpConnectionUsage("user-1", "grant-3", d1);

    expect(await listMcpConnectionLastUsedAt("user-1", d1)).toEqual(
      new Map([["grant-2", NOW]]),
    );
    expect(await listMcpConnectionLastUsedAt("user-2", d1)).toEqual(
      new Map([["grant-3", NOW]]),
    );
  });
});

describe("purgeOrphanedMcpConnectionUsages", () => {
  it("grant が無くなった接続の記録だけを消す", async () => {
    await record("grant-1", NOW);
    await record("grant-2", NOW);
    await record("grant-3", NOW);
    // ライブラリが grant だけを消した場合（同じクライアントにもう一度同意したときなど）
    await new D1KvStore(d1).delete("grant:user-1:grant-1");

    await purgeOrphanedMcpConnectionUsages(d1);

    expect(await listMcpConnectionLastUsedAt("user-1", d1)).toEqual(
      new Map([["grant-2", NOW]]),
    );
    expect(await listMcpConnectionLastUsedAt("user-2", d1)).toEqual(
      new Map([["grant-3", NOW]]),
    );
  });
});
