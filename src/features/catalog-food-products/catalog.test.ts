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
  catalogFoodProducts,
  foodProducts,
  householdMembers,
  households,
  mediaAssets,
  type NewCatalogFoodProduct,
  users,
} from "@/db/schema";
import { toPackageSizeValue } from "./packageSizes";
import { parseCatalogSearchParams } from "./search";

// 共通のごはん商品の検索と、家への追加を、実際のマイグレーションを適用した DB で確かめる
let db: ReturnType<typeof getDb>;
let sqlite: Database;
let SQL: Awaited<ReturnType<typeof initSqlJs>>;
vi.mock("@/db/client", () => ({ getDb: () => db }));
vi.mock("@/features/auth/session", () => ({
  requireUser: async () => ({ id: "user-1" }),
}));
vi.mock("@/features/media/storage", () => ({
  readMediaObject: vi.fn(async () => new Blob(["image"])),
  storeMediaAsset: vi.fn(async () => ({})),
}));

const {
  listAddedCatalogFoodProductIds,
  listCatalogFoodProductImageUrls,
  searchCatalogFoodProducts,
} = await import("./queries");
const { addCatalogFoodProductAction } = await import("./actions");
const { readMediaObject, storeMediaAsset } = await import(
  "@/features/media/storage"
);

async function addCatalog(
  values: Partial<NewCatalogFoodProduct> & { id: string; name: string },
) {
  await db.insert(catalogFoodProducts).values({
    kcalPer100g: 380,
    packageAmountG: 500,
    nutritionType: "complete",
    textureType: "dry",
    ...values,
  });
}

async function search(params: Record<string, string>) {
  const { items } = await searchCatalogFoodProducts(
    parseCatalogSearchParams(params),
  );
  return items.map((item) => item.id);
}

function addForm(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.append(key, value);
  }
  return data;
}

beforeAll(async () => {
  SQL = await initSqlJs();
});
beforeEach(async () => {
  vi.clearAllMocks();
  sqlite = new SQL.Database();
  const raw = drizzle(sqlite);
  await migrate(raw, { migrationsFolder: "./drizzle" });
  sqlite.run("PRAGMA foreign_keys = ON");
  db = raw as unknown as ReturnType<typeof getDb>;
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
  await addCatalog({
    id: "dry-adult",
    name: "まぐろ味 カリカリ",
    manufacturer: "ねこフード",
    lifeStages: ["adult", "senior"],
  });
  await addCatalog({
    id: "wet-kitten",
    name: "子ねこ用 パウチ 100%まぐろ",
    manufacturer: "いなば",
    textureType: "wet",
    nutritionType: "general",
    packageAmountG: 40,
    packageUnit: "袋",
    lifeStages: ["kitten"],
    targetBreed: "ペルシャ",
  });
  await addCatalog({
    id: "no-maker",
    name: "かつお スープ",
    textureType: "soup",
  });
});
afterEach(() => sqlite.close());

describe("searchCatalogFoodProducts", () => {
  it("条件がなければすべてを、メーカー名・商品名の順（メーカー名なしは最後）に返す", async () => {
    expect(await search({})).toEqual(["wet-kitten", "dry-adult", "no-maker"]);
  });

  it("キーワードは語ごとに、商品名かメーカー名のどちらかに含まれる商品に絞る", async () => {
    expect(await search({ q: "まぐろ" })).toEqual(["wet-kitten", "dry-adult"]);
    expect(await search({ q: "ねこフード まぐろ" })).toEqual(["dry-adult"]);
    expect(await search({ q: "ねこフード かつお" })).toEqual([]);
  });

  it("キーワードの % と _ はワイルドカードとして扱わない", async () => {
    expect(await search({ q: "100%" })).toEqual(["wet-kitten"]);
    expect(await search({ q: "%" })).toEqual(["wet-kitten"]);
    expect(await search({ q: "_" })).toEqual([]);
  });

  it("キーワードは検索キーワードの一部に含まれる商品にも絞り、語ごとに別の項目に含まれていてもよい", async () => {
    await addCatalog({
      id: "churu",
      name: "CIAO ちゅ〜る まぐろ",
      manufacturer: "いなば",
      textureType: "wet",
      searchKeywords: ["ちゅーる", "ちゃおちゅーる", "50%_off"],
    });
    expect(await search({ q: "ちゅーる" })).toEqual(["churu"]);
    expect(await search({ q: "ちゃお" })).toEqual(["churu"]);
    // 商品名の一部でも見つかる
    expect(await search({ q: "ちゅ〜る" })).toEqual(["churu"]);
    // 1 語目はメーカー名、2 語目は検索キーワード、3 語目は商品名に含まれる
    expect(await search({ q: "いなば ちゃおちゅーる まぐろ" })).toEqual([
      "churu",
    ]);
    expect(await search({ q: "ちゅーる かつお" })).toEqual([]);
    // 検索キーワードの % と _ もワイルドカードとして扱わない
    expect(await search({ q: "50%_" })).toEqual(["churu"]);
    expect(await search({ q: "ちゅ_る" })).toEqual([]);
  });

  it("メーカー名・種類・区分・対象の猫・猫種で絞り込む", async () => {
    expect(await search({ manufacturer: "いな" })).toEqual(["wet-kitten"]);
    expect(await search({ textureType: "soup" })).toEqual(["no-maker"]);
    expect(await search({ nutritionType: "complete" })).toEqual([
      "dry-adult",
      "no-maker",
    ]);
    expect(await search({ lifeStage: "senior" })).toEqual(["dry-adult"]);
    expect(await search({ targetBreed: "ペルシャ" })).toEqual(["wet-kitten"]);
    expect(await search({ q: "まぐろ", lifeStage: "kitten" })).toEqual([
      "wet-kitten",
    ]);
  });

  it("上限より多く見つかったときは上限までを返し、hasMore を立てる", async () => {
    for (let index = 0; index < 50; index += 1) {
      await addCatalog({ id: `bulk-${index}`, name: `まとめ ${index}` });
    }
    const result = await searchCatalogFoodProducts(
      parseCatalogSearchParams({}),
    );
    expect(result.items).toHaveLength(50);
    expect(result.hasMore).toBe(true);
  });
});

describe("listCatalogFoodProductImageUrls", () => {
  it("共通のごはん商品の画像の元データの URL を返す", async () => {
    await db.insert(mediaAssets).values({
      id: "catalog-image",
      recordType: "catalog_food_product",
      recordId: "dry-adult",
      objectKey: "catalog_food_product/dry-adult/catalog-image",
      mimeType: "image/jpeg",
    });
    expect(
      await listCatalogFoodProductImageUrls(["dry-adult", "wet-kitten"]),
    ).toEqual({ "dry-adult": "/media/catalog-image" });
  });
});

describe("addCatalogFoodProductAction", () => {
  it("内容を写した商品を家に追加し、画像を保存し直して家の一覧へ移動する", async () => {
    await db.insert(mediaAssets).values({
      id: "catalog-image",
      recordType: "catalog_food_product",
      recordId: "wet-kitten",
      objectKey: "catalog_food_product/wet-kitten/catalog-image",
      mimeType: "image/jpeg",
    });

    expect(
      await addCatalogFoodProductAction(
        "wet-kitten",
        {},
        addForm({
          packageSize: '[40,"袋"]',
          householdId: "household-1",
          returnToHousehold: "1",
        }),
      ),
    ).toEqual({ redirectTo: "/food-products?householdId=household-1" });

    const [added] = await db
      .select()
      .from(foodProducts)
      .where(eq(foodProducts.householdId, "household-1"));
    expect(added).toMatchObject({
      name: "子ねこ用 パウチ 100%まぐろ",
      manufacturer: "いなば",
      kcalPer100g: 380,
      packageAmountG: 40,
      packageUnit: "袋",
      nutritionType: "general",
      textureType: "wet",
      lifeStages: ["kitten"],
      targetBreed: "ペルシャ",
      catalogFoodProductId: "wet-kitten",
    });
    expect(added.id).not.toBe("wet-kitten");
    expect(readMediaObject).toHaveBeenCalledWith(
      "catalog_food_product/wet-kitten/catalog-image",
    );
    expect(storeMediaAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        recordType: "food_product",
        recordId: added.id,
        catId: null,
      }),
    );
    expect(await listAddedCatalogFoodProductIds("household-1")).toEqual(
      new Set(["wet-kitten"]),
    );
    expect(await listAddedCatalogFoodProductIds("household-2")).toEqual(
      new Set(),
    );
  });

  it("家を指定せずに開いたときは、すべての家の一覧へ移動する。画像がなければ保存しない", async () => {
    expect(
      await addCatalogFoodProductAction(
        "dry-adult",
        {},
        addForm({
          packageSize: "[500,null]",
          householdId: "household-1",
        }),
      ),
    ).toEqual({ redirectTo: "/food-products" });
    expect(storeMediaAsset).not.toHaveBeenCalled();
  });

  it("同じ家にすでに追加した商品は重ねて追加せず、追加済みとして一覧へ移動する", async () => {
    for (let index = 0; index < 2; index += 1) {
      expect(
        await addCatalogFoodProductAction(
          "dry-adult",
          {},
          addForm({
            packageSize: "[500,null]",
            householdId: "household-1",
            returnToHousehold: "1",
          }),
        ),
      ).toEqual({ redirectTo: "/food-products?householdId=household-1" });
    }
    expect(await db.select().from(foodProducts)).toHaveLength(1);
    // 一意インデックスで、同時に追加されても DB に 2 件目は入らない
    expect(() =>
      sqlite.run(
        `INSERT INTO food_products (id, household_id, name, kcal_per_100g, package_amount_g, nutrition_type, texture_type, catalog_food_product_id)
        VALUES ('dup', 'household-1', 'x', 1, 1, 'complete', 'dry', 'dry-adult')`,
      ),
    ).toThrow(/UNIQUE/);
    // 手動で登録した商品（追加元なし）は同じ家にいくつあってもよい
    await db.insert(foodProducts).values([
      {
        id: "manual-1",
        householdId: "household-1",
        name: "a",
        kcalPer100g: 1,
        packageAmountG: 1,
        nutritionType: "complete",
        textureType: "dry",
      },
      {
        id: "manual-2",
        householdId: "household-1",
        name: "b",
        kcalPer100g: 1,
        packageAmountG: 1,
        nutritionType: "complete",
        textureType: "dry",
      },
    ]);
  });

  it("画像を保存できなくても、商品は追加する", async () => {
    await db.insert(mediaAssets).values({
      id: "catalog-image",
      recordType: "catalog_food_product",
      recordId: "dry-adult",
      objectKey: "catalog_food_product/dry-adult/catalog-image",
      mimeType: "image/jpeg",
    });
    vi.mocked(storeMediaAsset).mockRejectedValueOnce(new Error("容量の上限"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(
      await addCatalogFoodProductAction(
        "dry-adult",
        {},
        addForm({
          packageSize: "[500,null]",
          householdId: "household-1",
        }),
      ),
    ).toEqual({ redirectTo: expect.any(String) });
    expect(await listAddedCatalogFoodProductIds("household-1")).toEqual(
      new Set(["dry-adult"]),
    );
  });

  it("所属していない家・存在しない商品には追加しない", async () => {
    expect(
      await addCatalogFoodProductAction(
        "dry-adult",
        {},
        addForm({
          packageSize: "[500,null]",
          householdId: "household-2",
        }),
      ),
    ).toEqual({ error: expect.any(String) });
    expect(
      await addCatalogFoodProductAction(
        "missing",
        {},
        addForm({
          packageSize: "[500,null]",
          householdId: "household-1",
        }),
      ),
    ).toEqual({ error: expect.any(String) });
    expect(
      await addCatalogFoodProductAction("dry-adult", {}, addForm({})),
    ).toEqual({ error: expect.any(String) });
    expect(await db.select().from(foodProducts)).toEqual([]);
  });

  it("内容量の候補から選んだ内容量で追加する", async () => {
    await addCatalog({
      id: "multi-size",
      name: "ささみ スティック",
      packageAmountG: 70,
      packageSizes: [
        { amountG: 70, unit: null },
        { amountG: 12.3, unit: "本" },
      ],
    });
    expect(
      await addCatalogFoodProductAction(
        "multi-size",
        {},
        addForm({
          householdId: "household-1",
          packageSize: toPackageSizeValue({ amountG: 12.3, unit: "本" }),
        }),
      ),
    ).toEqual({ redirectTo: "/food-products" });
    const [added] = await db.select().from(foodProducts);
    expect(added).toMatchObject({
      name: "ささみ スティック",
      packageAmountG: 12.3,
      packageUnit: "本",
      catalogFoodProductId: "multi-size",
    });
  });

  it("古い管理画面が元の内容量の列だけを更新していたら、その内容量で追加する", async () => {
    await addCatalog({
      id: "edited-by-old-admin",
      name: "古い管理画面で編集した商品",
      packageAmountG: 50,
      // 0050 で埋めたときの値のまま残っている
      packageSizes: [{ amountG: 40, unit: null }],
    });
    expect(
      await addCatalogFoodProductAction(
        "edited-by-old-admin",
        {},
        addForm({ householdId: "household-1", packageSize: "[40,null]" }),
      ),
    ).toEqual({ error: expect.stringContaining("内容量") });
    expect(
      await addCatalogFoodProductAction(
        "edited-by-old-admin",
        {},
        addForm({ householdId: "household-1", packageSize: "[50,null]" }),
      ),
    ).toEqual({ redirectTo: "/food-products" });
    const [added] = await db.select().from(foodProducts);
    expect(added).toMatchObject({ packageAmountG: 50, packageUnit: null });
  });

  it("候補にない内容量・内容量の指定がないときは追加しない", async () => {
    await addCatalog({
      id: "multi-size",
      name: "ささみ スティック",
      packageAmountG: 70,
      packageSizes: [
        { amountG: 70, unit: null },
        { amountG: 12.3, unit: "本" },
      ],
    });
    for (const packageSize of [
      // 単位だけが違う
      toPackageSizeValue({ amountG: 12.3, unit: null }),
      toPackageSizeValue({ amountG: 500, unit: null }),
      "[0,null]",
      "70",
    ]) {
      expect(
        await addCatalogFoodProductAction(
          "multi-size",
          {},
          addForm({ householdId: "household-1", packageSize }),
        ),
      ).toEqual({ error: expect.stringContaining("内容量") });
    }
    expect(
      await addCatalogFoodProductAction(
        "multi-size",
        {},
        addForm({ householdId: "household-1" }),
      ),
    ).toEqual({ error: expect.stringContaining("内容量") });
    // 候補が空の商品（候補を追加する前に登録された商品）は、元の内容量だけを候補とする
    expect(
      await addCatalogFoodProductAction(
        "dry-adult",
        {},
        addForm({ householdId: "household-1", packageSize: "[40,null]" }),
      ),
    ).toEqual({ error: expect.stringContaining("内容量") });
    expect(await db.select().from(foodProducts)).toEqual([]);
  });

  it("共通のごはん商品を削除しても、家に追加した商品は追加元が空になって残る", async () => {
    expect(
      await addCatalogFoodProductAction(
        "dry-adult",
        {},
        addForm({
          packageSize: "[500,null]",
          householdId: "household-1",
        }),
      ),
    ).toEqual({ redirectTo: expect.any(String) });
    await db
      .delete(catalogFoodProducts)
      .where(eq(catalogFoodProducts.id, "dry-adult"));
    const [added] = await db.select().from(foodProducts);
    expect(added).toMatchObject({
      name: "まぐろ味 カリカリ",
      catalogFoodProductId: null,
    });
  });
});
