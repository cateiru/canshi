// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { loginWithEmail } from "./login";

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

describe("loginWithEmail", () => {
  it("はじめてのメールアドレスでは、正規化したメールアドレスでユーザーを作る", async () => {
    const result = await loginWithEmail(" Owner@Example.com ", null);

    expect(result.isNewUser).toBe(true);
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(result.userId);
    expect(rows[0].email).toBe("owner@example.com");
    expect(await db.select().from(sessions)).toHaveLength(1);
  });

  it("メールアドレスを保存済みのユーザーでログインする", async () => {
    await db
      .insert(users)
      .values({ id: "owner", name: "オーナー", email: "owner@example.com" });

    const result = await loginWithEmail("OWNER@example.com", null);

    expect(result).toMatchObject({ userId: "owner", isNewUser: false });
    expect(await db.select().from(users)).toHaveLength(1);
  });
});
