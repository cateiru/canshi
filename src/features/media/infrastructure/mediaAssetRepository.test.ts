// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { insertWhere } from "@/db/conditionalInsert";
import {
  cats,
  expenseRecords,
  foodProducts,
  households,
  mediaAssets,
  poopRecords,
  users,
} from "@/db/schema";
import { PENDING_MEDIA_RECORD_TYPE } from "../domain/recordTypes";
import { createMediaAssetRepository } from "./mediaAssetRepository";
import { liveMediaRecordCondition } from "./recordOwner";

// `src/features/cats/infrastructure/catRepository.test.ts` と同様に `getDb` をテスト用の sql.js に差し替える
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
  sqlite.run("PRAGMA foreign_keys = ON");
  await db.insert(users).values({ id: "owner", name: "オーナー" });
  await db.insert(households).values({ id: "home", name: "わが家" });
  await db
    .insert(cats)
    .values({ id: "tama", name: "たま", sex: "female", householdId: "home" });
  await db.insert(poopRecords).values([
    {
      id: "live-poop",
      catId: "tama",
      occurredAt: new Date("2026-07-01T08:00:00Z"),
      consistency: "normal",
    },
    {
      id: "deleted-poop",
      catId: "tama",
      occurredAt: new Date("2026-07-01T20:00:00Z"),
      consistency: "normal",
      deletedAt: new Date("2026-07-02T00:00:00Z"),
    },
  ]);
  await db.insert(expenseRecords).values([
    {
      id: "live-expense",
      householdId: "home",
      spentAt: new Date("2026-07-01T00:00:00Z"),
      amountYen: 1000,
      category: "food",
    },
    {
      id: "deleted-expense",
      householdId: "home",
      spentAt: new Date("2026-07-01T00:00:00Z"),
      amountYen: 500,
      category: "food",
      deletedAt: new Date("2026-07-02T00:00:00Z"),
    },
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
});

function mediaRow(id: string, recordType: string, recordId: string) {
  return {
    id,
    uploadedByUserId: "owner",
    recordType,
    recordId,
    objectKey: `${recordType}/${recordId}/${id}`,
    mimeType: "image/png",
  };
}

async function insertPending(id: string) {
  await db
    .insert(mediaAssets)
    .values(mediaRow(id, PENDING_MEDIA_RECORD_TYPE, id));
}

async function findAsset(id: string) {
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id));
  return row;
}

describe("createMediaAssetRepository().assign", () => {
  it("削除されていない記録には下書きを紐付ける", async () => {
    await insertPending("draft");

    const assigned = await createMediaAssetRepository().assign(
      "poop_record",
      "live-poop",
      "tama",
      [{ id: "draft", sortOrder: 0, isPending: true }],
      "owner",
    );

    expect(assigned).toEqual(["draft"]);
    expect(await findAsset("draft")).toMatchObject({
      recordType: "poop_record",
      recordId: "live-poop",
      catId: "tama",
    });
  });

  it("論理削除された記録には下書きを紐付けず、下書きのまま残す", async () => {
    await insertPending("draft");

    const assigned = await createMediaAssetRepository().assign(
      "poop_record",
      "deleted-poop",
      "tama",
      [{ id: "draft", sortOrder: 0, isPending: true }],
      "owner",
    );

    expect(assigned).toEqual([]);
    expect(await findAsset("draft")).toMatchObject({
      recordType: PENDING_MEDIA_RECORD_TYPE,
      recordId: "draft",
      catId: null,
    });
  });

  it("論理削除された記録の既存の添付は並び順も変えない", async () => {
    await db.insert(mediaAssets).values({
      ...mediaRow("attached", "poop_record", "deleted-poop"),
      sortOrder: 3,
    });

    const assigned = await createMediaAssetRepository().assign(
      "poop_record",
      "deleted-poop",
      "tama",
      [{ id: "attached", sortOrder: 0, isPending: false }],
      "owner",
    );

    expect(assigned).toEqual([]);
    expect((await findAsset("attached")).sortOrder).toBe(3);
  });

  it("猫に紐付かない支出も、論理削除されていなければ紐付け、されていれば紐付けない", async () => {
    await insertPending("draft-live");
    await insertPending("draft-deleted");
    const repository = createMediaAssetRepository();

    expect(
      await repository.assign(
        "expense",
        "live-expense",
        null,
        [{ id: "draft-live", sortOrder: 0, isPending: true }],
        "owner",
      ),
    ).toEqual(["draft-live"]);
    expect(
      await repository.assign(
        "expense",
        "deleted-expense",
        null,
        [{ id: "draft-deleted", sortOrder: 0, isPending: true }],
        "owner",
      ),
    ).toEqual([]);
    expect((await findAsset("draft-deleted")).recordType).toBe(
      PENDING_MEDIA_RECORD_TYPE,
    );
  });

  it("論理削除のないごはん商品は、実在すれば紐付け、なければ紐付けない", async () => {
    await insertPending("draft-food");
    await insertPending("draft-missing");
    const repository = createMediaAssetRepository();

    expect(
      await repository.assign(
        "food_product",
        "food",
        null,
        [{ id: "draft-food", sortOrder: 0, isPending: true }],
        "owner",
      ),
    ).toEqual(["draft-food"]);
    expect(
      await repository.assign(
        "food_product",
        "missing-food",
        null,
        [{ id: "draft-missing", sortOrder: 0, isPending: true }],
        "owner",
      ),
    ).toEqual([]);
  });
});

describe("liveMediaRecordCondition", () => {
  // 記録へ直接アップロードするとき（`storeMediaAsset`）の挿入と同じ組み合わせで確かめる
  async function insertFor(id: string, recordType: string, recordId: string) {
    return insertWhere(
      db,
      mediaAssets,
      mediaRow(id, recordType, recordId),
      liveMediaRecordCondition(recordType, recordId),
    ).returning({ id: mediaAssets.id });
  }

  it("削除されていない記録にだけ挿入できる", async () => {
    expect(await insertFor("live", "poop_record", "live-poop")).toEqual([
      { id: "live" },
    ]);
    expect(await insertFor("deleted", "poop_record", "deleted-poop")).toEqual(
      [],
    );
    expect(await insertFor("missing", "poop_record", "missing-poop")).toEqual(
      [],
    );
    expect(await findAsset("deleted")).toBeUndefined();
  });

  it("猫のプロフィールは猫が実在すれば挿入できる", async () => {
    expect(await insertFor("profile", "cat_profile", "tama")).toEqual([
      { id: "profile" },
    ]);
    expect(await insertFor("no-cat", "cat_profile", "kuro")).toEqual([]);
  });

  it("記録の種別でないもの（下書きなど）には条件を付けない", () => {
    expect(
      liveMediaRecordCondition(PENDING_MEDIA_RECORD_TYPE, "draft"),
    ).toBeUndefined();
    expect(
      liveMediaRecordCondition("catalog_food_product", "catalog"),
    ).toBeUndefined();
  });
});
