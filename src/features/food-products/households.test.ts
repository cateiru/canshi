// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs, { type Database } from "sql.js";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { getDb } from "@/db/client";
import {
  cats,
  feedingPresetItems,
  feedingPresets,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
  householdMembers,
  households,
  users,
} from "@/db/schema";

// ごはん商品・プリセットを家に属させたことによる絞り込みと認可を、商品・プリセット・
// ごはん記録の Server Action とクエリを通して確かめる
let db: ReturnType<typeof getDb>;
let sqlite: Database;
let SQL: Awaited<ReturnType<typeof initSqlJs>>;
let beforeBatch: (() => Promise<void>) | undefined;
vi.mock("@/db/client", () => ({ getDb: () => db }));
vi.mock("@/features/media/storage", () => ({
  deleteMediaAssetsByRecord: vi.fn(),
}));
vi.mock("@/features/media/attach", () => ({
  syncRecordMediaFromForm: vi.fn(async () => undefined),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
// ログイン中のユーザーは既定で user-1（household-1 のメンバー）とし、`asUser` で切り替える。
// 猫単位の認可（requireCatAccess）は、実際と同じくユーザーの家の猫だけを許可する
let currentUserId = "user-1";
vi.mock("@/features/auth/session", async () => {
  const { getCatForUser } = await import("@/features/households/queries");
  return {
    requireUser: async () => ({ id: currentUserId }),
    requireCatAccess: async (catId: string) => {
      const cat = await getCatForUser(currentUserId, catId);
      if (!cat) throw new Error("notFound");
      return { user: { id: currentUserId }, cat };
    },
  };
});

async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  currentUserId = userId;
  try {
    return await fn();
  } finally {
    currentUserId = "user-1";
  }
}

const {
  createFoodProductAction,
  updateFoodProductAction,
  deleteFoodProductAction,
} = await import("./actions");
const { listFoodProducts, listFoodProductsForUser } = await import("./queries");
const {
  createFeedingPresetAction,
  updateFeedingPresetAction,
  deleteFeedingPresetAction,
} = await import("@/features/feeding-presets/actions");
const { listFeedingPresetsForUser, getFeedingPresetForUser } = await import(
  "@/features/feeding-presets/queries"
);
const { createFeedingRecordAction, updateFeedingRecordAction } = await import(
  "@/features/feeding-records/actions"
);
const { listRecentlyUsedFoodProductIds } = await import(
  "@/features/feeding-records/queries"
);
const { deleteMediaAssetsByRecord } = await import("@/features/media/storage");

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.append(key, value);
  }
  return data;
}
function productForm(values: Record<string, string> = {}) {
  return form({
    name: "カリカリ",
    kcalPer100g: "380",
    packageAmountG: "500",
    nutritionType: "complete",
    textureType: "dry",
    ...values,
  });
}
function presetForm(
  foodProductId: string,
  values: Record<string, string> = {},
) {
  return form({
    name: "朝ごはん",
    mode: "strict",
    "items.0.foodProductId": foodProductId,
    "items.0.givenAmountG": "30",
    ...values,
  });
}
function recordForm(foodProductId: string) {
  return form({
    occurredDate: "2026-10-08",
    occurredTime: "08:00",
    mode: "strict",
    "items.0.foodProductId": foodProductId,
    "items.0.givenAmountG": "30",
    "items.0.leftoverAmountG": "0",
  });
}
async function addProduct(id: string, householdId: string | null) {
  await db.insert(foodProducts).values({
    id,
    householdId,
    name: id,
    kcalPer100g: 380,
    packageAmountG: 500,
    nutritionType: "complete",
    textureType: "dry",
  });
}

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  vi.clearAllMocks();
  beforeBatch = undefined;
  sqlite = new SQL.Database();
  const raw = drizzle(sqlite);
  await migrate(raw, { migrationsFolder: "./drizzle" });
  sqlite.run("PRAGMA foreign_keys = ON");
  // 実際の SQLite トランザクションで D1 の batch を再現する。`beforeBatch` で、Action の確認から
  // batch の実行までの間に起きた変更（家から外されるなど）を差し込める
  const batch = async (statements: PromiseLike<unknown>[]) => {
    await beforeBatch?.();
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement);
    }
    return results;
  };
  db = Object.assign(raw, { batch }) as unknown as ReturnType<typeof getDb>;
  await db.insert(users).values([
    { id: "user-1", name: "管理者" },
    { id: "user-2", name: "別の家の人" },
  ]);
  await db.insert(households).values([
    { id: "household-1", name: "わが家" },
    { id: "household-2", name: "別の家" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "household-1", userId: "user-1" },
    { householdId: "household-2", userId: "user-2" },
  ]);
  await db.insert(cats).values([
    { id: "tama", name: "たま", sex: "female", householdId: "household-1" },
    { id: "kuro", name: "クロ", sex: "male", householdId: "household-2" },
  ]);
  await addProduct("food-1", "household-1");
  await addProduct("food-2", "household-2");
  await addProduct("food-legacy", null);
});
afterEach(() => sqlite.close());

describe("ごはん商品", () => {
  it("一覧には所属する家の商品だけを出し、家に未所属の商品は出さない", async () => {
    expect(
      (await listFoodProductsForUser("user-1")).map((product) => product.id),
    ).toEqual(["food-1"]);
    expect(
      (await listFoodProducts("household-2")).map((product) => product.id),
    ).toEqual(["food-2"]);
  });

  it("選んだ家に商品を登録する", async () => {
    const result = await createFoodProductAction(
      {},
      productForm({ householdId: "household-1" }),
    );

    const [created] = await db
      .select()
      .from(foodProducts)
      .where(eq(foodProducts.id, result.savedRecordId as string));
    expect(created.householdId).toBe("household-1");
  });

  it("所属していない家・未選択の家には登録できない", async () => {
    const cases: Record<string, string>[] = [
      { householdId: "household-2" },
      {},
    ];
    for (const values of cases) {
      const result = await createFoodProductAction({}, productForm(values));
      expect(result.fieldErrors?.householdId).toEqual([
        "所属している家を選択してください",
      ]);
    }
    expect(await db.select().from(foodProducts)).toHaveLength(3);
  });

  it("別の家の商品は編集・削除できない", async () => {
    expect(
      await updateFoodProductAction("food-2", {}, productForm({ name: "改" })),
    ).toEqual({ formError: "商品が見つかりませんでした" });
    expect(await deleteFoodProductAction("food-2")).toEqual({
      error: "商品が見つかりませんでした",
    });

    const [product] = await db
      .select()
      .from(foodProducts)
      .where(eq(foodProducts.id, "food-2"));
    expect(product.name).toBe("food-2");
  });

  it("所属する家の商品は編集・削除できる", async () => {
    await updateFoodProductAction("food-1", {}, productForm({ name: "改" }));
    const [product] = await db
      .select()
      .from(foodProducts)
      .where(eq(foodProducts.id, "food-1"));
    expect(product).toMatchObject({ name: "改", householdId: "household-1" });

    expect(await deleteFoodProductAction("food-1")).toEqual({});
    expect(
      await db.select().from(foodProducts).where(eq(foodProducts.id, "food-1")),
    ).toEqual([]);
  });
});

describe("ごはんプリセット", () => {
  it("選んだ家にプリセットを登録し、その家のメンバーにだけ見せる", async () => {
    await expect(
      createFeedingPresetAction(
        {},
        presetForm("food-1", { householdId: "household-1" }),
      ),
    ).resolves.toEqual({ redirectTo: "/feeding-presets" });

    const [preset] = await listFeedingPresetsForUser("user-1");
    expect(preset).toMatchObject({
      householdId: "household-1",
      items: [{ foodProductId: "food-1" }],
    });
    expect(await listFeedingPresetsForUser("user-2")).toEqual([]);
    expect(await getFeedingPresetForUser("user-2", preset.id)).toBeNull();
  });

  it("明細に別の家の商品は使えない", async () => {
    const result = await createFeedingPresetAction(
      {},
      presetForm("food-2", { householdId: "household-1" }),
    );

    expect(result).toEqual({
      formError: "選択された商品が見つかりませんでした",
    });
    expect(await db.select().from(feedingPresets)).toEqual([]);
  });

  it("所属していない家には登録できない", async () => {
    const result = await createFeedingPresetAction(
      {},
      presetForm("food-2", { householdId: "household-2" }),
    );

    expect(result.fieldErrors?.householdId).toEqual([
      "所属している家を選択してください",
    ]);
    expect(await db.select().from(feedingPresets)).toEqual([]);
  });

  it("別の家のプリセットは編集・削除できず、編集でも別の家の商品は使えない", async () => {
    await db
      .insert(feedingPresets)
      .values({ id: "preset-2", householdId: "household-2", name: "夜" });
    await db.insert(feedingPresetItems).values({
      presetId: "preset-2",
      foodProductId: "food-2",
      givenAmountG: 20,
    });

    expect(
      await updateFeedingPresetAction("preset-2", {}, presetForm("food-1")),
    ).toEqual({ formError: "プリセットが見つかりませんでした" });
    expect(await deleteFeedingPresetAction("preset-2")).toEqual({
      error: "プリセットが見つかりませんでした",
    });
    expect(
      await asUser("user-2", () =>
        updateFeedingPresetAction("preset-2", {}, presetForm("food-1")),
      ),
    ).toEqual({ formError: "選択された商品が見つかりませんでした" });
    expect(await db.select().from(feedingPresetItems)).toMatchObject([
      { presetId: "preset-2", foodProductId: "food-2" },
    ]);
  });
});

describe("確認の後に家から外された場合", () => {
  async function leaveHousehold() {
    await db
      .delete(householdMembers)
      .where(eq(householdMembers.userId, "user-1"));
  }

  it("商品の更新は通らない", async () => {
    // 商品の更新は確認と更新を 1 文で行うため、更新の直前に外されたものとして確かめる
    await leaveHousehold();

    expect(
      await updateFoodProductAction("food-1", {}, productForm({ name: "改" })),
    ).toEqual({ formError: "商品が見つかりませんでした" });
    const [product] = await db
      .select()
      .from(foodProducts)
      .where(eq(foodProducts.id, "food-1"));
    expect(product.name).toBe("food-1");
  });

  it("商品の削除は通らず、エラーを返す", async () => {
    // 商品の削除は確認の後に 1 文で行うため、DELETE を組み立てる直前に外されたものとする
    const originalDelete = db.delete.bind(db);
    vi.spyOn(db, "delete").mockImplementation((table) => {
      sqlite.run("DELETE FROM household_members WHERE user_id = 'user-1'");
      return originalDelete(table);
    });

    expect(await deleteFoodProductAction("food-1")).toEqual({
      error: "商品が見つかりませんでした",
    });
    expect(
      await db.select().from(foodProducts).where(eq(foodProducts.id, "food-1")),
    ).toHaveLength(1);
  });

  it("商品画像の削除に失敗したときは商品を残し、削除し直せる", async () => {
    vi.mocked(deleteMediaAssetsByRecord).mockRejectedValueOnce(
      new Error("R2 の削除に失敗"),
    );

    await expect(deleteFoodProductAction("food-1")).rejects.toThrow(
      "R2 の削除に失敗",
    );
    expect(
      await db.select().from(foodProducts).where(eq(foodProducts.id, "food-1")),
    ).toHaveLength(1);

    expect(await deleteFoodProductAction("food-1")).toEqual({});
    expect(
      await db.select().from(foodProducts).where(eq(foodProducts.id, "food-1")),
    ).toEqual([]);
  });

  it("プリセットの登録・更新・削除は通らない", async () => {
    await db
      .insert(feedingPresets)
      .values({ id: "preset-1", householdId: "household-1", name: "朝" });
    await db.insert(feedingPresetItems).values({
      presetId: "preset-1",
      foodProductId: "food-1",
      givenAmountG: 20,
    });
    beforeBatch = leaveHousehold;

    expect(
      await createFeedingPresetAction(
        {},
        presetForm("food-1", { householdId: "household-1" }),
      ),
    ).toEqual({
      fieldErrors: { householdId: ["所属している家を選択してください"] },
    });
    await db.insert(householdMembers).values({
      householdId: "household-1",
      userId: "user-1",
    });
    expect(
      await updateFeedingPresetAction(
        "preset-1",
        {},
        presetForm("food-1", { name: "改", "items.0.givenAmountG": "50" }),
      ),
    ).toEqual({ formError: "プリセットが見つかりませんでした" });
    await db.insert(householdMembers).values({
      householdId: "household-1",
      userId: "user-1",
    });
    expect(await deleteFeedingPresetAction("preset-1")).toEqual({});

    expect(await db.select().from(feedingPresets)).toMatchObject([
      { id: "preset-1", name: "朝" },
    ]);
    expect(await db.select().from(feedingPresetItems)).toMatchObject([
      { presetId: "preset-1", givenAmountG: 20 },
    ]);
  });
});

describe("ごはん記録の商品", () => {
  it("確認の後に猫が別の家へ引っ越した場合、記録の登録・更新は通らない", async () => {
    await db.insert(feedingRecords).values({
      id: "meal",
      catId: "tama",
      occurredAt: new Date("2026-10-01T08:00:00Z"),
    });
    await db.insert(feedingRecordItems).values({
      feedingRecordId: "meal",
      foodProductId: "food-1",
      givenAmountG: 20,
    });
    beforeBatch = async () => {
      await db
        .update(cats)
        .set({ householdId: "household-2" })
        .where(eq(cats.id, "tama"));
    };
    const error =
      "猫の家が変わったため保存できませんでした。もう一度やり直してください";

    await expect(
      createFeedingRecordAction("tama", {}, recordForm("food-1")),
    ).resolves.toEqual({ formError: error });
    await db
      .update(cats)
      .set({ householdId: "household-1" })
      .where(eq(cats.id, "tama"));
    await expect(
      updateFeedingRecordAction("tama", "meal", {}, recordForm("food-1")),
    ).resolves.toEqual({ formError: error });

    expect(await db.select().from(feedingRecords)).toMatchObject([
      { id: "meal" },
    ]);
    expect(await db.select().from(feedingRecordItems)).toMatchObject([
      { feedingRecordId: "meal", foodProductId: "food-1", givenAmountG: 20 },
    ]);
  });

  it("猫の家の商品だけを記録に使える", async () => {
    await expect(
      createFeedingRecordAction("tama", {}, recordForm("food-2")),
    ).resolves.toEqual({ formError: "選択された商品が見つかりませんでした" });
    await expect(
      createFeedingRecordAction("tama", {}, recordForm("food-legacy")),
    ).resolves.toEqual({ formError: "選択された商品が見つかりませんでした" });
    expect(await db.select().from(feedingRecords)).toEqual([]);

    await expect(
      createFeedingRecordAction("tama", {}, recordForm("food-1")),
    ).resolves.toEqual({ redirectTo: "/cats/tama/feeding-records" });
    expect(await db.select().from(feedingRecords)).toMatchObject([
      {
        catId: "tama",
        occurredAt: new Date("2026-10-08T08:00:00Z"),
        mode: "strict",
      },
    ]);
    expect(await db.select().from(feedingRecordItems)).toMatchObject([
      {
        foodProductId: "food-1",
        givenAmountG: 30,
        leftoverAmountG: 0,
        estimatedIntakeG: 30,
        estimatedKcal: 114,
        givenAmountLevel: null,
        sortOrder: 0,
      },
    ]);
    expect(await listRecentlyUsedFoodProductIds("tama", "household-1")).toEqual(
      ["food-1"],
    );
  });

  it("別の家へ引っ越す前の記録は、元の家の商品のまま編集できる", async () => {
    // household-2 の猫として記録した後、猫が household-1 へ引っ越したとする
    await db.insert(feedingRecords).values({
      id: "moved-meal",
      catId: "tama",
      occurredAt: new Date("2026-10-01T08:00:00Z"),
    });
    await db.insert(feedingRecordItems).values({
      feedingRecordId: "moved-meal",
      foodProductId: "food-2",
      givenAmountG: 20,
    });

    await expect(
      updateFeedingRecordAction("tama", "moved-meal", {}, recordForm("food-2")),
    ).resolves.toEqual({ redirectTo: "/cats/tama/feeding-records" });
    // 引っ越し先の家の商品に替えることもできる
    await expect(
      updateFeedingRecordAction("tama", "moved-meal", {}, recordForm("food-1")),
    ).resolves.toEqual({ redirectTo: "/cats/tama/feeding-records" });
    // 一度外した元の家の商品は、もう選べない
    await expect(
      updateFeedingRecordAction("tama", "moved-meal", {}, recordForm("food-2")),
    ).resolves.toEqual({ formError: "選択された商品が見つかりませんでした" });
    // 最近使った商品には、猫の家の商品だけを出す
    expect(await listRecentlyUsedFoodProductIds("tama", "household-1")).toEqual(
      ["food-1"],
    );
  });
});
