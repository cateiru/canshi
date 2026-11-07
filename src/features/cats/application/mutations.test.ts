// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { cats, householdMembers, households, users } from "@/db/schema";
import type { CatValues, NewCatValues } from "../domain/cat";
import { createCatForUser, updateCatForUser } from "./mutations";

// `src/features/notifications/queries.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

beforeEach(async () => {
  const SQL = await initSqlJs();
  const raw = drizzle(new SQL.Database());
  await migrate(raw, { migrationsFolder: "./drizzle" });
  // D1 の batch の代わりに、文を順に実行して結果を返す
  const batch = async (statements: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement);
    }
    return results;
  };
  db = Object.assign(raw, { batch }) as unknown as ReturnType<typeof getDb>;
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

function catValues(name = "たま"): CatValues {
  return {
    name,
    sex: "female",
    birthDate: null,
    birthDatePrecision: "day",
    breed: null,
    adoptedAt: null,
    neuterStatus: null,
    coatColor: null,
    coatPattern: null,
    coatWhite: null,
  };
}

function newCatValues(householdId: string, name = "たま"): NewCatValues {
  return { ...catValues(name), householdId };
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
    const id = await createCatForUser("both", newCatValues("second", "ミケ"));
    expect(id).not.toBeNull();
    expect(await getCat(id as string)).toEqual({
      name: "ミケ",
      householdId: "second",
    });
  });

  it("入力したすべての項目を、それぞれの列に保存する", async () => {
    const id = await createCatForUser("both", {
      name: "ミケ",
      sex: "male",
      birthDate: "2020-04-01",
      birthDatePrecision: "month",
      breed: "雑種",
      adoptedAt: "2020-06-01",
      neuterStatus: "neutered",
      coatColor: "brown",
      coatPattern: "classic_tabby",
      coatWhite: "high",
      householdId: "home",
    });
    const [row] = await db
      .select()
      .from(cats)
      .where(eq(cats.id, id as string));
    expect(row).toMatchObject({
      id,
      householdId: "home",
      name: "ミケ",
      sex: "male",
      birthDate: "2020-04-01",
      birthDatePrecision: "month",
      breed: "雑種",
      adoptedAt: "2020-06-01",
      neuterStatus: "neutered",
      coatColor: "brown",
      coatPattern: "classic_tabby",
      coatWhite: "high",
      profileMediaAssetId: null,
    });
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it("所属していない家・存在しない家には登録しない", async () => {
    expect(
      await createCatForUser("home-only", newCatValues("second")),
    ).toBeNull();
    expect(await createCatForUser("both", newCatValues("missing"))).toBeNull();
    expect(await db.select().from(cats)).toHaveLength(1);
  });
});

describe("updateCatForUser", () => {
  it("猫の家のメンバーなら、猫の情報を更新できる", async () => {
    expect(await updateCatForUser("tama", "home-only", catValues("タマ"))).toBe(
      true,
    );
    expect(await getCat("tama")).toEqual({ name: "タマ", householdId: "home" });
  });

  it("猫を飼う家は変えられない（値に家が混ざっていても書き換えない）", async () => {
    // 型にない値が実行時に混ざった場合を確かめるため、型を外して渡す
    const values = { ...catValues("タマ"), householdId: "second" } as CatValues;
    expect(await updateCatForUser("tama", "both", values)).toBe(true);
    expect(await getCat("tama")).toEqual({ name: "タマ", householdId: "home" });
  });

  it("猫の家に所属していなければ更新できない", async () => {
    expect(await updateCatForUser("tama", "stranger", catValues("クロ"))).toBe(
      false,
    );
    expect(await getCat("tama")).toEqual({ name: "たま", householdId: "home" });
  });

  it("存在しない猫は更新できない", async () => {
    expect(await updateCatForUser("missing", "both", catValues())).toBe(false);
  });
});
