// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { oauthKvEntries } from "@/db/schema";
import {
  D1KvStore,
  purgeExpiredOAuthKvEntries,
  revokedGrantMarkerKey,
} from "./d1KvStore";

// `src/features/auth/sessions.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const d1 = {} as D1Database;
const NOW = new Date("2026-10-12T00:00:00Z");

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

describe("D1KvStore", () => {
  it("保存した値を文字列・JSON で読み出せ、上書き・削除できる", async () => {
    const store = new D1KvStore(d1);

    await store.put("client:a", JSON.stringify({ clientId: "a" }));
    expect(await store.get("client:a")).toBe('{"clientId":"a"}');
    expect(await store.get("client:a", { type: "json" })).toEqual({
      clientId: "a",
    });

    await store.put("client:a", JSON.stringify({ clientId: "b" }));
    expect(await store.get("client:a", { type: "json" })).toEqual({
      clientId: "b",
    });

    await store.delete("client:a");
    expect(await store.get("client:a")).toBeNull();
    expect(await store.get("missing", { type: "json" })).toBeNull();
  });

  it("expirationTtl・expiration を過ぎた値は無いものとして扱う", async () => {
    const store = new D1KvStore(d1);
    await store.put("token:ttl", "1", { expirationTtl: 60 });
    await store.put("grant:exp", "2", {
      expiration: NOW.getTime() / 1000 + 600,
    });
    await store.put("client:forever", "3");

    vi.setSystemTime(new Date(NOW.getTime() + 61 * 1000));
    expect(await store.get("token:ttl")).toBeNull();
    expect(await store.get("grant:exp")).toBe("2");

    vi.setSystemTime(new Date(NOW.getTime() + 601 * 1000));
    expect(await store.get("grant:exp")).toBeNull();
    expect(await store.get("client:forever")).toBe("3");
    expect((await store.list()).keys).toEqual([{ name: "client:forever" }]);
  });

  it("上書きすると期限も置き換わる", async () => {
    const store = new D1KvStore(d1);
    await store.put("grant:a", "code", { expirationTtl: 60 });
    await store.put("grant:a", "granted");

    vi.setSystemTime(new Date(NOW.getTime() + 120 * 1000));
    expect(await store.get("grant:a")).toBe("granted");
  });

  it("list は prefix で絞り込み、キーの昇順に cursor で続きを返す", async () => {
    const store = new D1KvStore(d1);
    for (const key of [
      "grant:u1:c",
      "grant:u1:a",
      "grant:u2:b",
      "token:u1:a:x",
      "grant_other",
    ]) {
      await store.put(key, "{}");
    }

    const first = await store.list({ prefix: "grant:", limit: 2 });
    expect(first).toMatchObject({
      keys: [{ name: "grant:u1:a" }, { name: "grant:u1:c" }],
      list_complete: false,
      cursor: "grant:u1:c",
    });

    const second = await store.list({
      prefix: "grant:",
      limit: 2,
      cursor: "grant:u1:c",
    });
    expect(second).toMatchObject({
      keys: [{ name: "grant:u2:b" }],
      list_complete: true,
    });
    expect(second).not.toHaveProperty("cursor");

    expect((await store.list({ prefix: "grant:u1:" })).keys).toEqual([
      { name: "grant:u1:a" },
      { name: "grant:u1:c" },
    ]);
  });

  it("prefix の % や _ は LIKE のワイルドカードとして扱わない", async () => {
    const store = new D1KvStore(d1);
    await store.put("a_b", "1");
    await store.put("axb", "2");

    expect((await store.list({ prefix: "a_" })).keys).toEqual([
      { name: "a_b" },
    ]);
  });

  it("解除済みの目印がある grant・トークンは書き込まない", async () => {
    const store = new D1KvStore(d1);
    await store.put("grant:user-1:g1", "old");
    await store.put(revokedGrantMarkerKey("user-1", "g1"), "1", {
      expirationTtl: 60,
    });

    await store.put("grant:user-1:g1", "refreshed");
    await store.put("token:user-1:g1:t1", "token", { expirationTtl: 3600 });

    // 目印より前に書き込まれた grant は上書きされない（解除の処理が続けて削除する）
    expect(await store.get("grant:user-1:g1")).toBe("old");
    expect(await store.get("token:user-1:g1:t1")).toBeNull();
    // 目印は grant の列挙に混ざらない
    expect((await store.list({ prefix: "grant:user-1:" })).keys).toEqual([
      { name: "grant:user-1:g1" },
    ]);
  });

  it("目印が無い grant・トークンは、期限付きで書き込み・上書きできる", async () => {
    const store = new D1KvStore(d1);
    await store.put(revokedGrantMarkerKey("user-1", "g1"), "1");
    await store.put(revokedGrantMarkerKey("user-2", "g2"), "1");

    await store.put("grant:user-1:g2", "a");
    await store.put("grant:user-1:g2", "b", {
      expiration: NOW.getTime() / 1000 + 600,
    });
    await store.put("token:user-1:g2:t1", "token", { expirationTtl: 60 });

    expect(await store.get("grant:user-1:g2")).toBe("b");
    expect(await store.get("token:user-1:g2:t1")).toBe("token");
    const [grantRow] = await db
      .select()
      .from(oauthKvEntries)
      .where(eq(oauthKvEntries.key, "grant:user-1:g2"));
    expect(grantRow.expiresAt).toEqual(new Date(NOW.getTime() + 600 * 1000));

    vi.setSystemTime(new Date(NOW.getTime() + 61 * 1000));
    expect(await store.get("token:user-1:g2:t1")).toBeNull();
    expect(await store.get("grant:user-1:g2")).toBe("b");
  });
});

describe("purgeExpiredOAuthKvEntries", () => {
  it("期限切れの行だけを削除する", async () => {
    const store = new D1KvStore(d1);
    await store.put("token:old", "1", { expirationTtl: 60 });
    await store.put("token:new", "2", { expirationTtl: 3600 });
    await store.put("client:forever", "3");

    vi.setSystemTime(new Date(NOW.getTime() + 61 * 1000));
    await purgeExpiredOAuthKvEntries(d1);

    const keys = (await db.select().from(oauthKvEntries)).map((row) => row.key);
    expect(keys.sort()).toEqual(["client:forever", "token:new"]);
  });
});
