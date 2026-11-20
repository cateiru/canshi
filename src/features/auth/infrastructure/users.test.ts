// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { users } from "@/db/schema";
import {
  findOrCreateUserByEmail,
  findUnlinkedUserByEmailHash,
  findUserByEmail,
  INITIAL_USER_NAME,
  linkUserEmail,
  NEW_USER_NAME,
} from "./users";

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
});

describe("findOrCreateUserByEmail", () => {
  it("ユーザーが 1 件もなければ、管理者ユーザーとして作る", async () => {
    const user = await findOrCreateUserByEmail("owner@example.com");

    expect(user.name).toBe(INITIAL_USER_NAME);
    expect(user.role).toBe("admin");
    expect(user.email).toBe("owner@example.com");
    // 新しいユーザーにはハッシュを保存しない
    expect(user.emailHash).toBeNull();
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("同じメールアドレスでは同じユーザーを返し、ユーザーを増やさない", async () => {
    const first = await findOrCreateUserByEmail("owner@example.com");
    const second = await findOrCreateUserByEmail("owner@example.com");

    expect(second.id).toBe(first.id);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("2 人目以降は一般のユーザーとして作る", async () => {
    await findOrCreateUserByEmail("owner@example.com");
    const user = await findOrCreateUserByEmail("family@example.com");

    expect(user.name).toBe(NEW_USER_NAME);
    expect(user.role).toBe("member");
    expect(await db.select().from(users)).toHaveLength(2);
  });
});

describe("findUserByEmail", () => {
  it("メールアドレスのユーザーがいなければ作らずに null を返す", async () => {
    await db
      .insert(users)
      .values({ id: "unlinked", name: "未紐付け", emailHash: "hash-owner" });

    expect(await findUserByEmail("owner@example.com")).toBeNull();
    expect(await db.select().from(users)).toHaveLength(1);
  });
});

describe("findUnlinkedUserByEmailHash", () => {
  it("ハッシュに対応し、メールアドレスを持たないユーザーを返す", async () => {
    await db.insert(users).values({
      id: "legacy",
      name: "以前のユーザー",
      emailHash: "hash-owner",
    });

    expect((await findUnlinkedUserByEmailHash("hash-owner"))?.id).toBe(
      "legacy",
    );
    expect(await findUnlinkedUserByEmailHash("hash-family")).toBeNull();
  });

  it("メールアドレスを保存済みのユーザーは返さない", async () => {
    await db.insert(users).values({
      id: "linked",
      name: "保存済み",
      email: "owner@example.com",
      emailHash: "hash-owner",
    });

    expect(await findUnlinkedUserByEmailHash("hash-owner")).toBeNull();
  });
});

describe("linkUserEmail", () => {
  it("メールアドレスを持たないユーザーにメールアドレスを保存する", async () => {
    await db.insert(users).values({
      id: "legacy",
      name: "以前のユーザー",
      emailHash: "hash-owner",
    });

    const user = await linkUserEmail("legacy", "owner@example.com");

    expect(user.id).toBe("legacy");
    expect(user.email).toBe("owner@example.com");
    // 移し終えるまでは、ハッシュも残しておく
    expect(user.emailHash).toBe("hash-owner");
  });

  it("すでにメールアドレスを持つユーザーは上書きせずにエラーにする", async () => {
    await db.insert(users).values({
      id: "linked",
      name: "保存済み",
      email: "owner@example.com",
    });

    await expect(linkUserEmail("linked", "other@example.com")).rejects.toThrow(
      "ログインしたユーザーにメールアドレスを保存できませんでした",
    );
    const [row] = await db.select().from(users).where(eq(users.id, "linked"));
    expect(row.email).toBe("owner@example.com");
  });
});
