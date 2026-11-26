// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  apiTokens,
  cats,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
  householdMembers,
  households,
  mcpPermissions,
  memoLabels,
  memoRecordLabels,
  memoRecords,
  notifications,
  users,
} from "@/db/schema";
import { createCatRepository } from "./catRepository";

// `src/features/households/application/management.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));

beforeEach(async () => {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();
  db = drizzle(sqlite) as unknown as ReturnType<typeof getDb>;
  await migrate(db as unknown as ReturnType<typeof drizzle>, {
    migrationsFolder: "./drizzle",
  });
  // D1 と同じく外部キー制約を有効にし、参照されたままの行を消すと失敗させる
  sqlite.run("PRAGMA foreign_keys = ON");
  // sql.js は `db.batch`（D1 専用）を持たないため、順番に実行するだけの簡易実装で補う
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に D1 の batch を簡易実装する
  (db as any).batch = async (statements: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement);
    }
    return results;
  };
  await db.insert(users).values({ id: "owner", name: "オーナー" });
  await db.insert(households).values({ id: "home", name: "わが家" });
  await db
    .insert(householdMembers)
    .values({ householdId: "home", userId: "owner", role: "owner" });
  await db.insert(cats).values([
    { id: "tama", name: "たま", sex: "female", householdId: "home" },
    { id: "kuro", name: "くろ", sex: "male", householdId: "home" },
  ]);
  await db.insert(foodProducts).values({
    id: "food",
    householdId: "home",
    name: "カリカリ",
    kcalPer100g: 380,
    packageAmountG: 500,
    nutritionType: "complete",
    textureType: "dry",
  });
  await db.insert(feedingRecords).values([
    {
      id: "tama-meal",
      catId: "tama",
      occurredAt: new Date("2026-07-01T08:00:00Z"),
    },
    {
      id: "tama-deleted-meal",
      catId: "tama",
      occurredAt: new Date("2026-07-01T20:00:00Z"),
      deletedAt: new Date("2026-07-02T00:00:00Z"),
    },
    {
      id: "kuro-meal",
      catId: "kuro",
      occurredAt: new Date("2026-07-01T08:00:00Z"),
    },
  ]);
  await db.insert(feedingRecordItems).values([
    { feedingRecordId: "tama-meal", foodProductId: "food", givenAmountG: 30 },
    {
      feedingRecordId: "tama-deleted-meal",
      foodProductId: "food",
      givenAmountG: 20,
    },
    { feedingRecordId: "kuro-meal", foodProductId: "food", givenAmountG: 25 },
  ]);
});

describe("removeForUser", () => {
  it("ごはん記録（論理削除したものも含む）を明細ごと物理削除して、猫を削除する", async () => {
    await createCatRepository().removeForUser("owner", "tama");

    expect(await db.select().from(cats).where(eq(cats.id, "tama"))).toEqual([]);
    expect(
      (await db.select().from(feedingRecords)).map((record) => record.id),
    ).toEqual(["kuro-meal"]);
    // 別の猫の記録の明細は残す
    expect(
      (await db.select().from(feedingRecordItems)).map(
        (item) => item.feedingRecordId,
      ),
    ).toEqual(["kuro-meal"]);
  });

  it("メモ（論理削除したものも含む）をラベルの紐付けごと物理削除し、ラベルは残す", async () => {
    await db
      .insert(memoLabels)
      .values({ id: "label", householdId: "home", name: "大事" });
    await db.insert(memoRecords).values([
      { id: "tama-memo", catId: "tama", content: "メモ" },
      {
        id: "tama-deleted-memo",
        catId: "tama",
        content: "削除したメモ",
        deletedAt: new Date("2026-07-02T00:00:00Z"),
      },
      { id: "kuro-memo", catId: "kuro", content: "メモ" },
    ]);
    await db.insert(memoRecordLabels).values(
      ["tama-memo", "tama-deleted-memo", "kuro-memo"].map((memoRecordId) => ({
        memoRecordId,
        memoLabelId: "label",
      })),
    );

    await createCatRepository().removeForUser("owner", "tama");

    expect(
      (await db.select().from(memoRecords)).map((record) => record.id),
    ).toEqual(["kuro-memo"]);
    expect(await db.select().from(memoRecordLabels)).toEqual([
      { memoRecordId: "kuro-memo", memoLabelId: "label" },
    ]);
    expect(await db.select().from(memoLabels)).toHaveLength(1);
  });
});

describe("memorializeForMember", () => {
  async function insertNotification(
    id: string,
    values: Partial<typeof notifications.$inferInsert>,
  ) {
    await db.insert(notifications).values({
      id,
      kind: "weight_measurement",
      dedupeKey: id,
      title: "体重を測りましょう",
      body: "",
      url: "/",
      dueAt: new Date("2026-07-01T09:00:00Z"),
      ...values,
    });
  }

  it("メモリーへ移した日を保存し、まだ終わっていない通知を閉じる", async () => {
    await insertNotification("pending", { catId: "tama" });
    await insertNotification("snoozed", { catId: "tama", status: "snoozed" });
    await insertNotification("done", { catId: "tama", status: "done" });
    await insertNotification("kuro", { catId: "kuro" });

    expect(
      await createCatRepository().memorializeForMember(
        "owner",
        "tama",
        "2026-07-10",
      ),
    ).toBe(true);

    const [tama] = await db.select().from(cats).where(eq(cats.id, "tama"));
    expect(tama.memorialDate).toBe("2026-07-10");
    const statuses = Object.fromEntries(
      (await db.select().from(notifications)).map((row) => [
        row.id,
        row.status,
      ]),
    );
    expect(statuses).toEqual({
      pending: "dismissed",
      snoozed: "dismissed",
      done: "done",
      // ほかの猫の通知はそのまま
      kuro: "pending",
    });
  });

  it("すべてのユーザーの AI との接続から、この猫への書き込みの許可だけを外す", async () => {
    await db.insert(users).values({ id: "member", name: "メンバー" });
    await db.insert(mcpPermissions).values([
      {
        userId: "owner",
        clientId: "client-a",
        excludedRecordTypes: { tama: ["poop"] },
        writableRecordTypes: { tama: ["feeding"], kuro: ["weight"] },
      },
      {
        userId: "member",
        clientId: "client-b",
        writableRecordTypes: { tama: ["memo"] },
      },
    ]);

    await createCatRepository().memorializeForMember(
      "owner",
      "tama",
      "2026-07-10",
    );

    const rows = await db.select().from(mcpPermissions);
    expect(
      Object.fromEntries(
        rows.map((row) => [row.clientId, row.writableRecordTypes]),
      ),
    ).toEqual({
      "client-a": { kuro: ["weight"] },
      "client-b": {},
    });
    // 読み取りの範囲は変えない
    expect(
      rows.find((row) => row.clientId === "client-a")?.excludedRecordTypes,
    ).toEqual({ tama: ["poop"] });
  });

  it("すべてのユーザーの API トークンからも、この猫への書き込みの許可だけを外す", async () => {
    await db.insert(apiTokens).values({
      id: "token-a",
      userId: "owner",
      name: "トークン",
      tokenHash: "hash",
      excludedRecordTypes: { tama: ["poop"] },
      writableRecordTypes: { tama: ["feeding"], kuro: ["weight"] },
    });

    await createCatRepository().memorializeForMember(
      "owner",
      "tama",
      "2026-07-10",
    );

    const [token] = await db.select().from(apiTokens);
    expect(token.writableRecordTypes).toEqual({ kuro: ["weight"] });
    // 読み取りの範囲は変えない
    expect(token.excludedRecordTypes).toEqual({ tama: ["poop"] });
  });

  it("記録できる猫がいなくなった家の、ごはんの時間の通知を閉じる", async () => {
    await insertNotification("feeding-home", {
      householdId: "home",
      kind: "feeding_time",
    });
    const repository = createCatRepository();

    await repository.memorializeForMember("owner", "tama", "2026-07-10");
    // くろがまだ記録できるため、閉じない
    expect((await db.select().from(notifications))[0].status).toBe("pending");

    await repository.memorializeForMember("owner", "kuro", "2026-07-10");
    expect((await db.select().from(notifications))[0].status).toBe("dismissed");
  });

  it("家のメンバーでなければ、猫・通知・書き込みの許可を変えない", async () => {
    await db.insert(users).values({ id: "stranger", name: "よその人" });
    await insertNotification("pending", { catId: "tama" });
    await db.insert(mcpPermissions).values({
      userId: "owner",
      clientId: "client-a",
      writableRecordTypes: { tama: ["feeding"] },
    });

    expect(
      await createCatRepository().memorializeForMember(
        "stranger",
        "tama",
        "2026-07-10",
      ),
    ).toBe(false);

    const [tama] = await db.select().from(cats).where(eq(cats.id, "tama"));
    expect(tama.memorialDate).toBeNull();
    expect((await db.select().from(notifications))[0].status).toBe("pending");
    expect(
      (await db.select().from(mcpPermissions))[0].writableRecordTypes,
    ).toEqual({ tama: ["feeding"] });
  });

  it("すでにメモリーへ移した猫なら false を返し、日付を変えない", async () => {
    const repository = createCatRepository();
    await repository.memorializeForMember("owner", "tama", "2026-07-10");

    expect(
      await repository.memorializeForMember("owner", "tama", "2026-07-20"),
    ).toBe(false);
    const [tama] = await db.select().from(cats).where(eq(cats.id, "tama"));
    expect(tama.memorialDate).toBe("2026-07-10");
  });
});

describe("メモリーへ移した猫のプロフィール", () => {
  it("プロフィール・避妊去勢の状況を書き換えない", async () => {
    const repository = createCatRepository();
    await repository.memorializeForMember("owner", "tama", "2026-07-10");

    expect(
      await repository.updateForMember("owner", "tama", {
        name: "たまこ",
        sex: "female",
        birthDate: null,
        birthDatePrecision: "day",
        breed: null,
        adoptedAt: null,
        neuterStatus: null,
        coatColor: null,
      }),
    ).toBe(false);
    expect(await repository.markNeuteredForMember("owner", "tama")).toBe(false);
    const [tama] = await db.select().from(cats).where(eq(cats.id, "tama"));
    expect(tama.name).toBe("たま");
    expect(tama.neuterStatus).toBeNull();
  });
});

describe("restoreFromMemorialForMember", () => {
  it("メモリーから戻すと、プロフィールを書き換えられるようになる", async () => {
    const repository = createCatRepository();
    await repository.memorializeForMember("owner", "tama", "2026-07-10");

    expect(await repository.restoreFromMemorialForMember("owner", "tama")).toBe(
      true,
    );
    const [tama] = await db.select().from(cats).where(eq(cats.id, "tama"));
    expect(tama.memorialDate).toBeNull();
    expect(await repository.markNeuteredForMember("owner", "tama")).toBe(true);
  });

  it("メモリーへ移していない猫・家のメンバーでなければ false を返す", async () => {
    await db.insert(users).values({ id: "stranger", name: "よその人" });
    const repository = createCatRepository();

    expect(await repository.restoreFromMemorialForMember("owner", "tama")).toBe(
      false,
    );
    await repository.memorializeForMember("owner", "tama", "2026-07-10");
    expect(
      await repository.restoreFromMemorialForMember("stranger", "tama"),
    ).toBe(false);
  });
});
