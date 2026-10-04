// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { createSession, deleteSession, getSessionUser } from "./sessions";
import { hashSessionToken, SESSION_MAX_AGE_SECONDS } from "./sessionToken";

// `src/features/notifications/queries.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
  await db.insert(users).values([
    { id: "user-1", name: "管理者", role: "admin" },
    { id: "user-2", name: "家族" },
  ]);
});

describe("createSession / getSessionUser", () => {
  it("作ったセッションのトークンでユーザーを引ける", async () => {
    const { token, expiresAt } = await createSession("user-1");

    expect((await getSessionUser(token))?.id).toBe("user-1");
    // ログインから 30 日で期限が切れる
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(
      (SESSION_MAX_AGE_SECONDS - 60) * 1000,
    );
  });

  it("DB にはトークンそのものではなくハッシュを保存する", async () => {
    const { token } = await createSession("user-1");

    const rows = await db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(token);
    expect(rows[0].tokenHash).toBe(await hashSessionToken(token));
  });

  it("ログインのたびに別のトークンを発行する", async () => {
    const first = await createSession("user-1");
    const second = await createSession("user-1");

    expect(first.token).not.toBe(second.token);
    expect((await getSessionUser(first.token))?.id).toBe("user-1");
    expect((await getSessionUser(second.token))?.id).toBe("user-1");
  });

  it("存在しないトークン・期限切れのセッションでは null", async () => {
    expect(await getSessionUser("unknown-token")).toBeNull();

    const { token } = await createSession("user-2");
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.tokenHash, await hashSessionToken(token)));
    expect(await getSessionUser(token)).toBeNull();
  });

  it("新しくログインすると、同じユーザーの期限切れのセッションを削除する", async () => {
    const expired = await createSession("user-1");
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.tokenHash, await hashSessionToken(expired.token)));
    await createSession("user-2");
    await createSession("user-1");

    const rows = await db.select().from(sessions);
    expect(rows.map((row) => row.userId).sort()).toEqual(["user-1", "user-2"]);
  });
});

describe("deleteSession", () => {
  it("ログアウトしたセッションだけを使えなくする", async () => {
    const loggedOut = await createSession("user-1");
    const other = await createSession("user-1");

    await deleteSession(loggedOut.token);

    expect(await getSessionUser(loggedOut.token)).toBeNull();
    expect((await getSessionUser(other.token))?.id).toBe("user-1");
  });
});
