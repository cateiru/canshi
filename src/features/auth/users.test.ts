// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { getOrCreateLoginUser, INITIAL_USER_NAME } from "./users";

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

describe("getOrCreateLoginUser", () => {
  it("ユーザーがいなければ管理者ユーザーを 1 件作る", async () => {
    const user = await getOrCreateLoginUser();

    expect(user.name).toBe(INITIAL_USER_NAME);
    expect(user.role).toBe("admin");
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("2 回目以降は同じユーザーを返し、ユーザーを増やさない", async () => {
    const first = await getOrCreateLoginUser();
    const second = await getOrCreateLoginUser();

    expect(second.id).toBe(first.id);
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("ユーザーが登録済みなら最初に登録されたユーザーを使う", async () => {
    await db.insert(users).values([
      {
        id: "later",
        name: "あとから",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      },
      {
        id: "first",
        name: "最初",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);

    const user = await getOrCreateLoginUser();

    expect(user.id).toBe("first");
    expect(await db.select().from(users)).toHaveLength(2);
  });
});
