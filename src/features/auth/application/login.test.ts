// @vitest-environment node
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { hashEmail } from "../domain/emailHash";
import { loginWithEmail } from "./login";

// `src/features/notifications/queries.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

const SALT = "test-salt-0123456789";
const env = { EMAIL_HASH_SALT: SALT };

beforeEach(async () => {
  const SQL = await initSqlJs();
  db = drizzle(new SQL.Database()) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
});

describe("loginWithEmail", () => {
  it("はじめてのメールアドレスでは、正規化したメールアドレスでユーザーを作る", async () => {
    const result = await loginWithEmail(" Owner@Example.com ", env, null);

    expect(result.isNewUser).toBe(true);
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(result.userId);
    expect(rows[0].email).toBe("owner@example.com");
    expect(rows[0].emailHash).toBeNull();
    expect(await db.select().from(sessions)).toHaveLength(1);
  });

  it("メールアドレスを保存済みのユーザーでログインする", async () => {
    await db
      .insert(users)
      .values({ id: "owner", name: "オーナー", email: "owner@example.com" });

    const result = await loginWithEmail("OWNER@example.com", env, null);

    expect(result).toMatchObject({ userId: "owner", isNewUser: false });
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("メールアドレスを持たない以前のユーザーは、ハッシュで見つけてメールアドレスを保存する", async () => {
    await db.insert(users).values({
      id: "legacy",
      name: "以前のユーザー",
      emailHash: hashEmail("owner@example.com", SALT),
    });

    const result = await loginWithEmail("Owner@Example.com", env, null);

    expect(result).toMatchObject({ userId: "legacy", isNewUser: false });
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("owner@example.com");
  });

  it("ハッシュが一致しなければ、以前のユーザーとは別のユーザーを作る", async () => {
    await db.insert(users).values({
      id: "legacy",
      name: "以前のユーザー",
      emailHash: hashEmail("owner@example.com", SALT),
    });

    const result = await loginWithEmail("family@example.com", env, null);

    expect(result.userId).not.toBe("legacy");
    expect(result.isNewUser).toBe(true);
    expect(await db.select().from(users)).toHaveLength(2);
  });
});
