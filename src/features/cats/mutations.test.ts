// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { cats, householdMembers, households, users } from "@/db/schema";
import {
  type CatValues,
  createCatForUser,
  updateCatForUser,
} from "./mutations";

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
    { id: "both", name: "2 つの家に所属する人" },
    { id: "home-only", name: "わが家だけに所属する人" },
    { id: "stranger", name: "別の家の人" },
  ]);
  await db.insert(households).values([
    { id: "home", name: "わが家" },
    { id: "second", name: "実家" },
    { id: "other", name: "別の家" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "home", userId: "both", role: "owner" },
    { householdId: "second", userId: "both", role: "owner" },
    { householdId: "home", userId: "home-only" },
    { householdId: "other", userId: "stranger", role: "owner" },
  ]);
  await db
    .insert(cats)
    .values({ id: "tama", name: "たま", sex: "female", householdId: "home" });
});

function catValues(householdId: string, name = "たま"): CatValues {
  return {
    name,
    sex: "female",
    birthDate: null,
    birthDatePrecision: "day",
    breed: null,
    adoptedAt: null,
    householdId,
  };
}

async function getCat(id: string) {
  const [row] = await db
    .select({ name: cats.name, householdId: cats.householdId })
    .from(cats)
    .where(eq(cats.id, id));
  return row;
}

describe("createCatForUser", () => {
  it("所属する家を選べば、その家に猫を登録する", async () => {
    const id = await createCatForUser("both", catValues("second", "ミケ"));
    expect(id).not.toBeNull();
    expect(await getCat(id as string)).toEqual({
      name: "ミケ",
      householdId: "second",
    });
  });

  it("所属していない家・存在しない家には登録しない", async () => {
    expect(await createCatForUser("home-only", catValues("second"))).toBeNull();
    expect(await createCatForUser("both", catValues("missing"))).toBeNull();
    expect(await db.select().from(cats)).toHaveLength(1);
  });
});

describe("updateCatForUser", () => {
  it("同じ家のまま猫の情報を更新できる", async () => {
    expect(
      await updateCatForUser("tama", "home-only", catValues("home", "タマ")),
    ).toBe("updated");
    expect(await getCat("tama")).toEqual({ name: "タマ", householdId: "home" });
  });

  it("両方の家に所属していれば、猫を別の家へ引っ越せる", async () => {
    expect(await updateCatForUser("tama", "both", catValues("second"))).toBe(
      "updated",
    );
    expect(await getCat("tama")).toEqual({
      name: "たま",
      householdId: "second",
    });
  });

  it("引っ越し先の家に所属していなければ引っ越せない", async () => {
    expect(
      await updateCatForUser("tama", "home-only", catValues("second")),
    ).toBe("household-not-allowed");
    expect(await updateCatForUser("tama", "both", catValues("other"))).toBe(
      "household-not-allowed",
    );
    expect((await getCat("tama")).householdId).toBe("home");
  });

  it("今の家に所属していなければ、自分の家へ引っ越すこともできない", async () => {
    expect(
      await updateCatForUser("tama", "stranger", catValues("other", "クロ")),
    ).toBe("not-found");
    expect(await getCat("tama")).toEqual({ name: "たま", householdId: "home" });
  });

  it("存在しない猫は not-found", async () => {
    expect(await updateCatForUser("missing", "both", catValues("home"))).toBe(
      "not-found",
    );
  });
});
