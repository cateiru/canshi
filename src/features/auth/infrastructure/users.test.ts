// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { users } from "@/db/schema";
import {
  findOrCreateUserByEmail,
  findUserByEmail,
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

describe("findOrCreateUserByEmail", () => {
  it("ユーザーが 1 件もなければ、管理者ユーザーとして作る", async () => {
    const user = await findOrCreateUserByEmail("owner@example.com");

    expect(user.name).toBe(INITIAL_USER_NAME);
    expect(user.role).toBe("admin");
    expect(user.email).toBe("owner@example.com");
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
      .values({ id: "family", name: "家族", email: "family@example.com" });

    expect(await findUserByEmail("owner@example.com")).toBeNull();
    expect(await db.select().from(users)).toHaveLength(1);
  });
});
