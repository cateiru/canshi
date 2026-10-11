// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { users } from "@/db/schema";
import {
  findOrCreateUserByEmailHash,
  findUserByEmailHash,
  INITIAL_USER_NAME,
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

describe("findOrCreateUserByEmailHash", () => {
  it("ユーザーが 1 件もなければ、管理者ユーザーとして作る", async () => {
    const user = await findOrCreateUserByEmailHash("hash-owner");

    expect(user.name).toBe(INITIAL_USER_NAME);
    expect(user.role).toBe("admin");
    expect(user.emailHash).toBe("hash-owner");
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("同じハッシュでは同じユーザーを返し、ユーザーを増やさない", async () => {
    const first = await findOrCreateUserByEmailHash("hash-owner");
    const second = await findOrCreateUserByEmailHash("hash-owner");

    expect(second.id).toBe(first.id);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("2 人目以降は一般のユーザーとして作る", async () => {
    await findOrCreateUserByEmailHash("hash-owner");
    const user = await findOrCreateUserByEmailHash("hash-family");

    expect(user.name).toBe(NEW_USER_NAME);
    expect(user.role).toBe("member");
    expect(await db.select().from(users)).toHaveLength(2);
  });

  it("メールアドレスを紐付けた既存のユーザーを返す", async () => {
    await db.insert(users).values([
      { id: "unlinked", name: "未紐付け" },
      { id: "linked", name: "紐付け済み", emailHash: "hash-owner" },
    ]);

    const user = await findOrCreateUserByEmailHash("hash-owner");

    expect(user.id).toBe("linked");
    expect(await db.select().from(users)).toHaveLength(2);
  });
});

describe("findUserByEmailHash", () => {
  it("ハッシュに対応するユーザーがいなければ作らずに null を返す", async () => {
    await db.insert(users).values({ id: "unlinked", name: "未紐付け" });

    expect(await findUserByEmailHash("hash-owner")).toBeNull();
    expect(await db.select().from(users)).toHaveLength(1);
  });
});
