// @vitest-environment node
import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import {
  catalogFoodProducts,
  cats,
  expenseRecordCats,
  expenseRecords,
  feedingPresets,
  feedingRecordItems,
  feedingRecords,
  foodProducts,
  householdMembers,
  households,
  mcpPermissions,
  medicationDoses,
  medications,
  poopRecords,
  users,
  weightRecords,
} from "@/db/schema";
import {
  MCP_PERMISSION_RECORD_TYPES,
  type McpHouseholdOperation,
} from "../permissionRules";
import type { McpToolContext } from "./context";

// `src/features/symptoms/actions.test.ts` と同様に、`getDb` をテスト用の sql.js に差し替え、
// D1 専用の `db.batch` は順番に実行するだけの簡易実装で補う。商品画像の保存（R2）は
// このテストの対象外のため差し替える（共通のごはん商品の画像の加工は差し替えずに行う）
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({
  getDb: () => db,
}));
const { storeMediaAsset, deleteMediaAssetRows } = vi.hoisted(() => ({
  storeMediaAsset: vi.fn(async () => ({ id: "asset-1" })),
  deleteMediaAssetRows: vi.fn(async () => {}),
}));
vi.mock("@/features/media/storage", () => ({
  storeMediaAsset,
  deleteMediaAssetRows,
  MediaUploadError: class extends Error {},
}));
const { replaceCatalogFoodProductImage } = vi.hoisted(() => ({
  replaceCatalogFoodProductImage: vi.fn(async () => true),
}));
vi.mock(
  "@/features/catalog-food-products/mutations",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/features/catalog-food-products/mutations")
    >()),
    replaceCatalogFoodProductImage,
  }),
);

const { registerRecordTools } = await import("./records");
const { registerFoodProductTools } = await import("./foodProducts");
const { registerFeedingPresetTools } = await import("./feedingPresets");
const { registerCatalogFoodProductTools } = await import(
  "./catalogFoodProducts"
);

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

// biome-ignore lint/suspicious/noExplicitAny: ツールの引数はツールごとに異なる
const handlers = new Map<string, (args: any) => Promise<ToolResult>>();

/** ツールを呼び、結果の JSON か、エラーのメッセージを返す */
async function call(name: string, args: Record<string, unknown> = {}) {
  const handler = handlers.get(name);
  if (!handler) {
    throw new Error(`ツール ${name} が登録されていません`);
  }
  const result = await handler(args);
  const text = result.content[0].text;
  return result.isError
    ? { error: text }
    : { value: JSON.parse(text) as Record<string, unknown> };
}

/** 接続の範囲を保存する。書き込み・操作は指定したものだけを許可する */
async function allow(scope: Partial<typeof mcpPermissions.$inferInsert>) {
  await db
    .insert(mcpPermissions)
    .values({ userId: "user-1", clientId: "client-1", ...scope })
    .onConflictDoUpdate({
      target: [mcpPermissions.userId, mcpPermissions.clientId],
      set: scope,
    });
}

/** ユーザー1 の猫すべてに、すべての記録の種類の書き込みを許可する範囲 */
const WRITE_ALL_RECORDS = {
  writableRecordTypes: Object.fromEntries(
    ["cat-1", "cat-2", "cat-3"].map((catId) => [
      catId,
      [...MCP_PERMISSION_RECORD_TYPES],
    ]),
  ),
};

/** ユーザー1 の家すべてで、指定した操作を許可する範囲 */
function operations(...allowed: McpHouseholdOperation[]) {
  return {
    householdOperations: { "house-1": allowed, "house-2": allowed },
  };
}

beforeEach(async () => {
  const SQL = await initSqlJs();
  const raw = drizzle(new SQL.Database());
  await migrate(raw, { migrationsFolder: "./drizzle" });
  db = raw as unknown as ReturnType<typeof getDb>;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用に D1 の batch を簡易実装する
  (db as any).batch = async (statements: PromiseLike<unknown>[]) => {
    const results: unknown[] = [];
    for (const statement of statements) {
      results.push(await statement);
    }
    return results;
  };

  await db.insert(users).values([
    { id: "user-1", name: "ユーザー1" },
    { id: "user-2", name: "ユーザー2" },
  ]);
  await db.insert(households).values([
    { id: "house-1", name: "家1" },
    { id: "house-2", name: "家2" },
    { id: "house-3", name: "ほかの人の家" },
  ]);
  await db.insert(householdMembers).values([
    { householdId: "house-1", userId: "user-1", role: "owner" },
    { householdId: "house-2", userId: "user-1", role: "owner" },
    { householdId: "house-3", userId: "user-2", role: "owner" },
  ]);
  await db.insert(cats).values([
    { id: "cat-1", name: "たま", sex: "female", householdId: "house-1" },
    { id: "cat-2", name: "みけ", sex: "female", householdId: "house-1" },
    { id: "cat-3", name: "くろ", sex: "male", householdId: "house-2" },
    { id: "cat-4", name: "しろ", sex: "male", householdId: "house-3" },
  ]);

  handlers.clear();
  const server = {
    registerTool: (
      name: string,
      _config: unknown,
      handler: (args: unknown) => Promise<ToolResult>,
    ) => {
      handlers.set(name, handler);
    },
  } as unknown as McpServer;
  const ctx: McpToolContext = {
    env: {} as Env,
    resolveConnection: async () => ({
      userId: "user-1",
      clientId: "client-1",
    }),
  };
  registerRecordTools(server, ctx);
  registerFoodProductTools(server, ctx);
  registerFeedingPresetTools(server, ctx);
  registerCatalogFoodProductTools(server, ctx);

  storeMediaAsset.mockClear();
  deleteMediaAssetRows.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("記録の追加", () => {
  it("範囲を保存していない接続は、読み取れる猫にも記録を追加できない", async () => {
    const result = await call("create_poop_record", {
      catId: "cat-1",
      consistency: "normal",
    });

    expect(result.error).toContain(
      "この猫のうんちの記録の書き込みが許可されていません",
    );
    expect(await db.select().from(poopRecords)).toEqual([]);
  });

  it("書き込みを許可していない猫・記録の種類には追加できない", async () => {
    await allow({ writableRecordTypes: { "cat-1": ["feeding"] } });

    for (const [catId, tool] of [
      ["cat-1", "create_poop_record"],
      ["cat-2", "create_feeding_record"],
    ]) {
      const result = await call(tool, {
        catId,
        consistency: "normal",
        mode: "strict",
        items: [],
      });
      expect(result.error).toContain("の書き込みが許可されていません");
    }
  });

  it("日時を省略すると、日本時間の今の日時で記録する", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 日本時間では 2026-10-20 00:30
    vi.setSystemTime(new Date("2026-10-19T15:30:00.000Z"));
    await allow(WRITE_ALL_RECORDS);

    const result = await call("create_poop_record", {
      catId: "cat-1",
      consistency: "soft",
      hasBlood: true,
      memo: "少し柔らかい",
    });

    const [record] = await db.select().from(poopRecords);
    expect(result.value).toEqual({ id: record.id });
    expect(record).toMatchObject({
      catId: "cat-1",
      occurredAt: new Date("2026-10-20T00:30:00.000Z"),
      consistency: "soft",
      hasBlood: true,
      hasForeignObject: false,
      memo: "少し柔らかい",
    });
  });

  it("フォームと同じ検証を通らなければ追加しない", async () => {
    await allow(WRITE_ALL_RECORDS);

    const result = await call("create_poop_record", {
      catId: "cat-1",
      occurredTime: "25:00",
    });

    expect(result.error).toContain("記録時刻の形式が正しくありません");
    expect(result.error).toContain("consistency");
    expect(await db.select().from(poopRecords)).toEqual([]);
  });

  it("読み取りを許可していない家・猫、ほかの人の猫は、存在しない猫と区別しない", async () => {
    await allow({
      ...WRITE_ALL_RECORDS,
      excludedHouseholdIds: ["house-2"],
      excludedCatIds: ["cat-2"],
    });

    for (const catId of ["cat-2", "cat-3", "cat-4", "missing"]) {
      const result = await call("create_poop_record", {
        catId,
        consistency: "normal",
      });
      expect(result.error).toBe(`catId="${catId}" の猫が見つかりません`);
    }
    expect(await db.select().from(poopRecords)).toEqual([]);
  });

  it("読み取りを許可していない記録の種類は追加できない", async () => {
    await allow({
      ...WRITE_ALL_RECORDS,
      excludedRecordTypes: { "cat-1": ["poop"] },
    });

    const result = await call("create_poop_record", {
      catId: "cat-1",
      consistency: "normal",
    });

    expect(result.error).toContain(
      "この猫のうんちの記録の書き込みが許可されていません",
    );
    expect(await db.select().from(poopRecords)).toEqual([]);
  });

  it("投薬の記録は、省略すると画面と同じく投薬できたものとして記録する", async () => {
    await allow(WRITE_ALL_RECORDS);
    await db.insert(medications).values({
      id: "medication-1",
      catId: "cat-1",
      name: "くすり",
      doseAmount: "1錠",
      dosesPerDay: 1,
      startDate: "2026-10-01",
    });

    await call("create_medication_dose", {
      catId: "cat-1",
      medicationId: "medication-1",
    });

    const [dose] = await db.select().from(medicationDoses);
    expect(dose).toMatchObject({
      medicationId: "medication-1",
      wasAdministered: true,
    });
  });

  it("体重は猫の体重だけを指定すると、そのまま猫の体重として記録する", async () => {
    await allow(WRITE_ALL_RECORDS);

    await call("create_weight_record", { catId: "cat-1", catWeightKg: 4.2 });

    const [record] = await db.select().from(weightRecords);
    expect(record).toMatchObject({ inputMethod: "direct", catWeightKg: 4.2 });
  });
});

describe("記録の編集", () => {
  it("体重を猫の体重だけで直すと、人間を含んだ体重などは空にする", async () => {
    await allow(WRITE_ALL_RECORDS);
    const [record] = await db
      .insert(weightRecords)
      .values({
        catId: "cat-1",
        occurredAt: new Date("2026-10-01T08:00:00.000Z"),
        inputMethod: "auto",
        combinedWeightKg: 64,
        humanWeightKg: 60,
        catWeightKg: 4,
      })
      .returning();

    await call("update_weight_record", {
      catId: "cat-1",
      id: record.id,
      catWeightKg: 4.3,
    });

    const [updated] = await db.select().from(weightRecords);
    expect(updated).toMatchObject({
      inputMethod: "direct",
      combinedWeightKg: null,
      humanWeightKg: null,
      catWeightKg: 4.3,
    });
  });

  async function createPoop() {
    const [record] = await db
      .insert(poopRecords)
      .values({
        catId: "cat-1",
        occurredAt: new Date("2026-10-01T08:00:00.000Z"),
        consistency: "normal",
        hasBlood: true,
        memo: "朝",
      })
      .returning();
    return record;
  }

  it("書き込みを許可していない記録の種類は編集できない", async () => {
    const record = await createPoop();
    await allow({ writableRecordTypes: { "cat-1": ["feeding"] } });

    const result = await call("update_poop_record", {
      catId: "cat-1",
      id: record.id,
      consistency: "hard",
    });

    expect(result.error).toContain(
      "この猫のうんちの記録の書き込みが許可されていません",
    );
    const [unchanged] = await db.select().from(poopRecords);
    expect(unchanged.consistency).toBe("normal");
  });

  it("指定した項目だけを変え、省略した項目は今の値のまま", async () => {
    const record = await createPoop();
    await allow(WRITE_ALL_RECORDS);

    const result = await call("update_poop_record", {
      catId: "cat-1",
      id: record.id,
      consistency: "hard",
    });

    expect(result.value).toEqual({ id: record.id });
    const [updated] = await db.select().from(poopRecords);
    expect(updated).toMatchObject({
      occurredAt: new Date("2026-10-01T08:00:00.000Z"),
      consistency: "hard",
      hasBlood: true,
      memo: "朝",
    });
  });

  it("null を指定した任意の項目は空にし、false の真偽値は外す", async () => {
    const record = await createPoop();
    await allow(WRITE_ALL_RECORDS);

    await call("update_poop_record", {
      catId: "cat-1",
      id: record.id,
      memo: null,
      hasBlood: false,
    });

    const [updated] = await db.select().from(poopRecords);
    expect(updated).toMatchObject({ memo: null, hasBlood: false });
  });

  it("ほかの猫の記録は、猫の ID を変えても編集できない", async () => {
    const record = await createPoop();
    await allow(WRITE_ALL_RECORDS);

    const result = await call("update_poop_record", {
      catId: "cat-2",
      id: record.id,
      consistency: "hard",
    });

    expect(result.error).toContain("見つかりません");
    const [unchanged] = await db.select().from(poopRecords);
    expect(unchanged.consistency).toBe("normal");
  });
});

describe("ごはんの記録", () => {
  it("猫の家の商品で追加し、編集で明細を省略すると今の明細のまま", async () => {
    await allow(WRITE_ALL_RECORDS);
    await db.insert(foodProducts).values([
      { id: "product-1", householdId: "house-1", ...PRODUCT },
      { id: "product-2", householdId: "house-2", ...PRODUCT },
    ] as (typeof foodProducts.$inferInsert)[]);

    const otherHousehold = await call("create_feeding_record", {
      catId: "cat-1",
      mode: "strict",
      items: [
        { foodProductId: "product-2", givenAmountG: 30, leftoverAmountG: 0 },
      ],
    });
    expect(otherHousehold.error).toBe("選択された商品が見つかりませんでした");

    const created = await call("create_feeding_record", {
      catId: "cat-1",
      occurredDate: "2026-10-01",
      occurredTime: "07:30",
      mode: "strict",
      items: [
        { foodProductId: "product-1", givenAmountG: 30, leftoverAmountG: 5 },
      ],
    });
    const id = created.value?.id as string;

    await call("update_feeding_record", {
      catId: "cat-1",
      id,
      occurredTime: "08:00",
    });

    const [record] = await db.select().from(feedingRecords);
    expect(record.occurredAt).toEqual(new Date("2026-10-01T08:00:00.000Z"));
    const items = await db.select().from(feedingRecordItems);
    expect(items).toMatchObject([
      {
        foodProductId: "product-1",
        givenAmountG: 30,
        leftoverAmountG: 5,
        estimatedIntakeG: 25,
        estimatedKcal: 20,
      },
    ]);
  });
});

describe("支出の記録", () => {
  it("関連する猫に、書き込めない猫は指定できない", async () => {
    await allow({
      ...WRITE_ALL_RECORDS,
      excludedRecordTypes: { "cat-2": ["expense"] },
    });

    const result = await call("create_expense", {
      catId: "cat-1",
      amountYen: 1000,
      category: "food",
      catIds: ["cat-2"],
    });

    expect(result.error).toBe('catId="cat-2" の猫が見つかりません');
    expect(await db.select().from(expenseRecords)).toEqual([]);
  });

  it("関連する猫を置き換えても、この接続から見えない猫の紐付けは残す", async () => {
    await allow({
      ...WRITE_ALL_RECORDS,
      excludedRecordTypes: { "cat-2": ["expense"] },
    });
    const [expense] = await db
      .insert(expenseRecords)
      .values({
        householdId: "house-1",
        spentAt: new Date("2026-10-01T00:00:00.000Z"),
        amountYen: 500,
        category: "food",
      })
      .returning();
    await db.insert(expenseRecordCats).values([
      { expenseRecordId: expense.id, catId: "cat-1" },
      { expenseRecordId: expense.id, catId: "cat-2" },
    ]);

    const result = await call("update_expense", {
      catId: "cat-1",
      id: expense.id,
      catIds: [],
      amountYen: 800,
    });

    expect(result.value).toEqual({ id: expense.id });
    const links = await db
      .select({ catId: expenseRecordCats.catId })
      .from(expenseRecordCats)
      .where(eq(expenseRecordCats.expenseRecordId, expense.id));
    expect(links.map((link) => link.catId).sort()).toEqual(["cat-1", "cat-2"]);
    const [updated] = await db.select().from(expenseRecords);
    expect(updated.amountYen).toBe(800);
  });
});

const PRODUCT = {
  name: "まぐろ",
  kcalPer100g: 80,
  packageAmountG: 70,
  nutritionType: "general",
  textureType: "wet",
};

/** 1x1 の PNG */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("ごはん商品", () => {
  it("読み取りを許可していない接続は、一覧を取得できない", async () => {
    const result = await call("list_food_products");

    expect(result.error).toContain(
      "「ごはん商品の読み取り」が許可されていません",
    );
  });

  it("読み取りを許可していない家の商品は、指定した家でも読めない", async () => {
    await allow({ householdOperations: { "house-1": ["foodProduct:read"] } });

    expect(
      (await call("list_food_products", { householdId: "house-2" })).error,
    ).toBe(
      "この接続には家「家2」での「ごはん商品の読み取り」が許可されていません。" +
        "CANSHI の設定の「AIとの接続」で、ユーザーに許可してもらってください",
    );
    expect(
      (
        await call("create_food_product", {
          householdId: "house-1",
          ...PRODUCT,
        })
      ).error,
    ).toContain("家「家1」での「ごはん商品の追加」が許可されていません");
  });

  it("複数の家の商品を、まとめて新しく登録した順に返す", async () => {
    await allow(operations("foodProduct:read"));
    await db.insert(foodProducts).values([
      {
        id: "product-old",
        householdId: "house-1",
        ...PRODUCT,
        createdAt: new Date("2026-10-01T00:00:00Z"),
      },
      {
        id: "product-new",
        householdId: "house-2",
        ...PRODUCT,
        createdAt: new Date("2026-10-03T00:00:00Z"),
      },
      {
        id: "product-middle",
        householdId: "house-1",
        ...PRODUCT,
        createdAt: new Date("2026-10-02T00:00:00Z"),
      },
    ] as (typeof foodProducts.$inferInsert)[]);

    const result = await call("list_food_products");

    expect(
      (result.value as { foodProducts: { id: string }[] }).foodProducts.map(
        ({ id }) => id,
      ),
    ).toEqual(["product-new", "product-middle", "product-old"]);
  });

  it("読み取りを許可していない家・ほかの人の家の商品は一覧に含めない", async () => {
    await allow({
      ...operations("foodProduct:read"),
      excludedHouseholdIds: ["house-2"],
    });
    await db.insert(foodProducts).values([
      { id: "product-1", householdId: "house-1", ...PRODUCT },
      { id: "product-2", householdId: "house-2", ...PRODUCT },
      { id: "product-3", householdId: "house-3", ...PRODUCT },
    ] as (typeof foodProducts.$inferInsert)[]);

    const result = await call("list_food_products");

    expect(
      (result.value as { foodProducts: { id: string }[] }).foodProducts.map(
        ({ id }) => id,
      ),
    ).toEqual(["product-1"]);
    expect(
      (await call("list_food_products", { householdId: "house-2" })).error,
    ).toBe('householdId="house-2" の家が見つかりません');
  });

  it("読み取りを許可した家に商品と画像を追加する", async () => {
    await allow({
      ...operations("foodProduct:create"),
      excludedHouseholdIds: ["house-2"],
    });

    const denied = await call("create_food_product", {
      householdId: "house-2",
      ...PRODUCT,
    });
    expect(denied.error).toBe('householdId="house-2" の家が見つかりません');
    const others = await call("create_food_product", {
      householdId: "house-3",
      ...PRODUCT,
    });
    expect(others.error).toBe('householdId="house-3" の家が見つかりません');

    const result = await call("create_food_product", {
      householdId: "house-1",
      ...PRODUCT,
      image: `data:image/png;base64,${PNG_BASE64}`,
    });

    const [product] = await db.select().from(foodProducts);
    expect(result.value).toEqual({ id: product.id });
    expect(product).toMatchObject({ householdId: "house-1", name: "まぐろ" });
    expect(storeMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        recordType: "food_product",
        recordId: product.id,
      }),
      expect.anything(),
    );
  });

  it("画像でないデータは、商品を追加する前に断る", async () => {
    await allow(operations("foodProduct:create"));

    const result = await call("create_food_product", {
      householdId: "house-1",
      ...PRODUCT,
      image: btoa("not an image"),
    });

    expect(result.error).toContain("image が画像");
    expect(await db.select().from(foodProducts)).toEqual([]);
  });

  it("編集では指定した項目だけを変える", async () => {
    await allow(operations("foodProduct:update"));
    await db.insert(foodProducts).values({
      id: "product-1",
      householdId: "house-1",
      ...PRODUCT,
      manufacturer: "メーカー",
    } as typeof foodProducts.$inferInsert);

    await call("update_food_product", { id: "product-1", kcalPer100g: 90 });

    const [product] = await db.select().from(foodProducts);
    expect(product).toMatchObject({
      name: "まぐろ",
      manufacturer: "メーカー",
      kcalPer100g: 90,
    });
  });
});

describe("ごはんのプリセット", () => {
  beforeEach(async () => {
    await db.insert(foodProducts).values([
      { id: "product-1", householdId: "house-1", ...PRODUCT },
      { id: "product-2", householdId: "house-2", ...PRODUCT },
    ] as (typeof foodProducts.$inferInsert)[]);
  });

  it("追加・編集・削除はそれぞれ許可した操作だけを行える", async () => {
    await allow(operations("feedingPreset:create"));
    const created = await call("create_feeding_preset", {
      householdId: "house-1",
      name: "朝ごはん",
      mode: "strict",
      items: [{ foodProductId: "product-1", givenAmountG: 30 }],
    });
    const id = created.value?.id as string;
    expect(id).toBeTypeOf("string");

    expect((await call("delete_feeding_preset", { id })).error).toContain(
      "「ごはんのプリセットの削除」が許可されていません",
    );

    await allow(operations("feedingPreset:update", "feedingPreset:delete"));
    expect(
      (await call("update_feeding_preset", { id, name: "夜ごはん" })).value,
    ).toEqual({ id });
    const [preset] = await db.select().from(feedingPresets);
    expect(preset).toMatchObject({ name: "夜ごはん", mode: "strict" });

    expect((await call("delete_feeding_preset", { id })).value).toEqual({
      id,
      deleted: true,
    });
    expect(await db.select().from(feedingPresets)).toEqual([]);
  });

  it("ほかの家の商品は明細に使えない", async () => {
    await allow(operations("feedingPreset:create"));

    const result = await call("create_feeding_preset", {
      householdId: "house-1",
      name: "朝ごはん",
      mode: "strict",
      items: [{ foodProductId: "product-2", givenAmountG: 30 }],
    });

    expect(result.error).toBe("選択された商品が見つかりませんでした");
  });

  it("読み取りを許可していない家のプリセットは扱えない", async () => {
    await db.insert(feedingPresets).values({
      id: "preset-1",
      householdId: "house-2",
      name: "家2のプリセット",
      mode: "strict",
    });
    await allow({
      ...operations("feedingPreset:read", "feedingPreset:delete"),
      excludedHouseholdIds: ["house-2"],
    });

    expect((await call("list_feeding_presets")).value).toEqual({
      feedingPresets: [],
    });
    expect(
      (await call("delete_feeding_preset", { id: "preset-1" })).error,
    ).toBe('id="preset-1" のプリセットが見つかりません');
    expect(await db.select().from(feedingPresets)).toHaveLength(1);
  });
});

describe("共通のごはん商品", () => {
  const product = {
    name: "まぐろ",
    manufacturer: "ねこフード",
    kcalPer100g: 80,
    packageSizes: [
      { amountG: 14, unit: "1本" },
      { amountG: 400, unit: null },
    ],
    nutritionType: "general",
    textureType: "wet",
    lifeStages: ["senior", "kitten"],
  };

  async function makeAdmin(role: "admin" | "member" = "admin") {
    await db.update(users).set({ role }).where(eq(users.id, "user-1"));
  }

  it("admin でないユーザーは、接続に許可していても扱えない", async () => {
    await allow({
      catalogOperations: [
        "catalogFoodProduct:read",
        "catalogFoodProduct:create",
      ],
    });

    expect((await call("list_catalog_food_products")).error).toContain(
      "管理者のユーザーだけが扱えます",
    );
    expect(
      (await call("create_catalog_food_product", product)).error,
    ).toContain("管理者のユーザーだけが扱えます");
    expect(await db.select().from(catalogFoodProducts)).toEqual([]);
  });

  it("admin でも、接続に許可していない操作は行えない", async () => {
    await makeAdmin();
    await allow({ catalogOperations: ["catalogFoodProduct:read"] });

    expect(
      (await call("create_catalog_food_product", product)).error,
    ).toContain("「共通のごはん商品の追加」が許可されていません");
    expect(await db.select().from(catalogFoodProducts)).toEqual([]);
  });

  it("追加すると、先頭の内容量の候補を内容量の列にも書く", async () => {
    await makeAdmin();
    await allow({
      catalogOperations: [
        "catalogFoodProduct:read",
        "catalogFoodProduct:create",
      ],
    });

    const created = await call("create_catalog_food_product", product);
    const [row] = await db.select().from(catalogFoodProducts);

    expect(created.value).toEqual({ id: row.id });
    expect(row).toMatchObject({
      name: "まぐろ",
      manufacturer: "ねこフード",
      kcalPer100g: 80,
      // 単位の先頭の「1」は家のごはん商品と同じく取り除く
      packageAmountG: 14,
      packageUnit: "本",
      packageSizes: [
        { amountG: 14, unit: "本" },
        { amountG: 400, unit: null },
      ],
      lifeStages: ["kitten", "senior"],
      targetBreed: null,
    });
    expect(
      (await call("list_catalog_food_products", { keyword: "ねこ まぐろ" }))
        .value,
    ).toEqual({
      catalogFoodProducts: [
        {
          id: row.id,
          name: "まぐろ",
          manufacturer: "ねこフード",
          kcalPer100g: 80,
          packageSizes: [
            { amountG: 14, unit: "本" },
            { amountG: 400, unit: null },
          ],
          nutritionType: "general",
          textureType: "wet",
          lifeStages: ["kitten", "senior"],
          targetBreed: null,
          searchKeywords: [],
          hasImage: false,
        },
      ],
      hasMore: false,
    });
  });

  it("内容量の候補が無い・同じ内容量がある場合は追加しない", async () => {
    await makeAdmin();
    await allow({ catalogOperations: ["catalogFoodProduct:create"] });

    for (const packageSizes of [
      [],
      [
        { amountG: 14, unit: "本" },
        { amountG: 14, unit: "1本" },
      ],
    ]) {
      expect(
        (
          await call("create_catalog_food_product", {
            ...product,
            packageSizes,
          })
        ).error,
      ).toContain("入力が正しくありません");
    }
    expect(await db.select().from(catalogFoodProducts)).toEqual([]);
  });

  it("編集では指定した項目だけを変え、内容量の候補は指定すると置き換える", async () => {
    await makeAdmin();
    await allow({
      catalogOperations: [
        "catalogFoodProduct:create",
        "catalogFoodProduct:update",
      ],
    });
    const created = await call("create_catalog_food_product", product);
    const id = created.value?.id;

    expect(
      (
        await call("update_catalog_food_product", {
          id,
          name: "まぐろ（新）",
          manufacturer: null,
        })
      ).value,
    ).toEqual({ id });
    const [renamed] = await db.select().from(catalogFoodProducts);
    expect(renamed).toMatchObject({
      name: "まぐろ（新）",
      manufacturer: null,
      kcalPer100g: 80,
      packageAmountG: 14,
      packageUnit: "本",
      packageSizes: [
        { amountG: 14, unit: "本" },
        { amountG: 400, unit: null },
      ],
      lifeStages: ["kitten", "senior"],
    });

    await call("update_catalog_food_product", {
      id,
      packageSizes: [{ amountG: 70, unit: "袋" }],
    });
    const [resized] = await db.select().from(catalogFoodProducts);
    expect(resized).toMatchObject({
      name: "まぐろ（新）",
      packageAmountG: 70,
      packageUnit: "袋",
      packageSizes: [{ amountG: 70, unit: "袋" }],
    });

    expect(
      (await call("update_catalog_food_product", { id: "missing", name: "x" }))
        .error,
    ).toContain("共通のごはん商品が見つかりません");
  });

  it("検索キーワードを登録・編集し、キーワードの一部で検索できる", async () => {
    await makeAdmin();
    await allow({
      catalogOperations: [
        "catalogFoodProduct:read",
        "catalogFoodProduct:create",
        "catalogFoodProduct:update",
      ],
    });
    const created = await call("create_catalog_food_product", {
      ...product,
      // 前後の空白を除き、空の語と重複した語は保存しない
      searchKeywords: [" ちゅーる ", "", "ちゅーる", "ちゃおちゅーる"],
    });
    const id = created.value?.id;
    const [row] = await db.select().from(catalogFoodProducts);
    expect(row.searchKeywords).toEqual(["ちゅーる", "ちゃおちゅーる"]);
    const listed = await call("list_catalog_food_products", {
      keyword: "ちゃお",
    });
    expect(listed.value?.catalogFoodProducts).toEqual([
      expect.objectContaining({
        id,
        searchKeywords: ["ちゅーる", "ちゃおちゅーる"],
      }),
    ]);

    // 省略した編集では今のキーワードのまま、指定すると置き換える
    await call("update_catalog_food_product", { id, name: "まぐろ（新）" });
    expect(
      (await db.select().from(catalogFoodProducts))[0].searchKeywords,
    ).toEqual(["ちゅーる", "ちゃおちゅーる"]);
    await call("update_catalog_food_product", { id, searchKeywords: [] });
    expect(
      (await db.select().from(catalogFoodProducts))[0].searchKeywords,
    ).toEqual([]);

    expect(
      (
        await call("update_catalog_food_product", {
          id,
          searchKeywords: Array.from(
            { length: 21 },
            (_, index) => `語${index}`,
          ),
        })
      ).error,
    ).toContain("検索キーワードは20件までです");
  });

  it("画像を正方形の JPEG にして登録・差し替える", async () => {
    await makeAdmin();
    await allow({
      catalogOperations: [
        "catalogFoodProduct:create",
        "catalogFoodProduct:update",
      ],
    });

    const created = await call("create_catalog_food_product", {
      ...product,
      image: `data:image/png;base64,${PNG_BASE64}`,
    });
    const [row] = await db.select().from(catalogFoodProducts);
    expect(created.value).toEqual({ id: row.id });
    expect(replaceCatalogFoodProductImage).toHaveBeenCalledWith(
      row.id,
      { bytes: expect.any(Uint8Array), size: 1 },
      expect.anything(),
    );

    const { MediaUploadError } = await import("@/features/media/storage");
    replaceCatalogFoodProductImage.mockRejectedValueOnce(
      new MediaUploadError("保存容量の上限を超えるためアップロードできません"),
    );
    expect(
      (
        await call("update_catalog_food_product", {
          id: row.id,
          name: "まぐろ（新）",
          image: PNG_BASE64,
        })
      ).error,
    ).toBe(
      "商品は保存しましたが、画像を保存できませんでした。保存容量の上限を超えるためアップロードできません",
    );
    expect((await db.select().from(catalogFoodProducts))[0].name).toBe(
      "まぐろ（新）",
    );
  });

  it("画像の保存が想定外のエラーで失敗しても、保存した商品の ID を返す", async () => {
    await makeAdmin();
    await allow({
      catalogOperations: [
        "catalogFoodProduct:create",
        "catalogFoodProduct:update",
      ],
    });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    replaceCatalogFoodProductImage.mockRejectedValue(new Error("R2 の障害"));

    const created = await call("create_catalog_food_product", {
      ...product,
      image: PNG_BASE64,
    });
    const [row] = await db.select().from(catalogFoodProducts);
    expect(created.value).toEqual({
      id: row.id,
      imageError: expect.stringContaining("画像を保存できませんでした"),
    });
    expect(
      (
        await call("update_catalog_food_product", {
          id: row.id,
          image: PNG_BASE64,
        })
      ).error,
    ).toContain("商品は保存しましたが、画像を保存できませんでした");
    expect(consoleError).toHaveBeenCalled();

    replaceCatalogFoodProductImage.mockResolvedValue(true);
    consoleError.mockRestore();
  });

  it("画像でないデータは、商品を保存する前に断る", async () => {
    await makeAdmin();
    await allow({
      catalogOperations: [
        "catalogFoodProduct:create",
        "catalogFoodProduct:update",
      ],
    });

    expect(
      (
        await call("create_catalog_food_product", {
          ...product,
          image: btoa("not an image"),
        })
      ).error,
    ).toContain("image が画像");
    expect(await db.select().from(catalogFoodProducts)).toEqual([]);

    const created = await call("create_catalog_food_product", product);
    expect(
      (
        await call("update_catalog_food_product", {
          id: created.value?.id,
          name: "書き換え",
          image: btoa("not an image"),
        })
      ).error,
    ).toContain("image が画像");
    expect((await db.select().from(catalogFoodProducts))[0].name).toBe(
      "まぐろ",
    );
    expect(replaceCatalogFoodProductImage).not.toHaveBeenCalled();
  });

  it("許可した後に admin でなくなると、編集できなくなる", async () => {
    await makeAdmin();
    await allow({
      catalogOperations: [
        "catalogFoodProduct:create",
        "catalogFoodProduct:update",
      ],
    });
    const created = await call("create_catalog_food_product", product);

    await makeAdmin("member");

    expect(
      (
        await call("update_catalog_food_product", {
          id: created.value?.id,
          name: "書き換え",
        })
      ).error,
    ).toContain("管理者のユーザーだけが扱えます");
    const [row] = await db.select().from(catalogFoodProducts);
    expect(row.name).toBe("まぐろ");
  });
});
