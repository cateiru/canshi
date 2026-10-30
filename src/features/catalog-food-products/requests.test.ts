// @vitest-environment node
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sql-js";
import { migrate } from "drizzle-orm/sql-js/migrator";
import initSqlJs from "sql.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getDb } from "@/db/client";
import { catalogFoodProductRequests, notifications, users } from "@/db/schema";
import { listPendingNotifications } from "@/features/notifications/queries";
import { parseCatalogSearchParams } from "./search";

// 実際のマイグレーションを適用した DB で確かめる。D1 専用の `db.batch` は順番に実行するだけの
// 簡易実装で補う
let db: ReturnType<typeof getDb>;
vi.mock("@/db/client", () => ({ getDb: () => db }));

const {
  completeCatalogFoodProductRequest,
  createCatalogFoodProductRequest,
  formatCatalogSearchCriteria,
  hasCatalogSearchCriteria,
  hasOpenCatalogFoodProductRequest,
  listCatalogFoodProductRequests,
  MAX_OPEN_CATALOG_REQUESTS,
  toCatalogSearchQuery,
} = await import("./requests");

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
    { id: "user-1", name: "たろう" },
    { id: "user-2", name: "はなこ" },
  ]);
});

const criteria = (params: Record<string, string>) =>
  parseCatalogSearchParams(params);

describe("toCatalogSearchQuery", () => {
  it("項目の順番を固定し、未指定の条件は含めない", () => {
    expect(
      toCatalogSearchQuery(
        criteria({
          targetBreed: "マンチカン",
          textureType: "wet",
          q: " まぐろ  カリカリ ",
        }),
      ),
    ).toBe(
      "q=%E3%81%BE%E3%81%90%E3%82%8D+%E3%82%AB%E3%83%AA%E3%82%AB%E3%83%AA&textureType=wet&targetBreed=%E3%83%9E%E3%83%B3%E3%83%81%E3%82%AB%E3%83%B3",
    );
    expect(toCatalogSearchQuery(criteria({}))).toBe("");
  });

  it("検索ページで読み直すと、同じ検索条件になる", () => {
    const original = criteria({
      q: "まぐろ",
      manufacturer: "いなば",
      textureType: "dry",
      nutritionType: "complete",
      lifeStage: "senior",
      targetBreed: "ペルシャ",
    });
    expect(
      parseCatalogSearchParams(
        Object.fromEntries(new URLSearchParams(toCatalogSearchQuery(original))),
      ),
    ).toEqual(original);
  });
});

describe("formatCatalogSearchCriteria", () => {
  it("指定した条件だけを、検索フォームの項目名で並べる", () => {
    expect(
      formatCatalogSearchCriteria(
        criteria({
          q: "まぐろ カリカリ",
          manufacturer: "いなば",
          textureType: "wet",
          nutritionType: "general",
          lifeStage: "kitten",
          targetBreed: "マンチカン",
        }),
      ),
    ).toBe(
      "キーワード：まぐろ カリカリ、メーカー名：いなば、種類：ウェット、区分：一般食、対象の猫：キトン、対象の猫種：マンチカン",
    );
  });
});

describe("hasCatalogSearchCriteria", () => {
  it("キーワードか詳しい条件を 1 つでも指定しているか", () => {
    expect(hasCatalogSearchCriteria(criteria({}))).toBe(false);
    expect(hasCatalogSearchCriteria(criteria({ q: "  " }))).toBe(false);
    expect(hasCatalogSearchCriteria(criteria({ q: "まぐろ" }))).toBe(true);
    expect(hasCatalogSearchCriteria(criteria({ textureType: "wet" }))).toBe(
      true,
    );
  });
});

describe("createCatalogFoodProductRequest", () => {
  it("検索条件と要約を保存し、同じ条件の未完了のリクエストは重ねて作らない", async () => {
    const search = criteria({ q: "まぐろ", textureType: "wet" });

    expect(await hasOpenCatalogFoodProductRequest("user-1", search)).toBe(
      false,
    );
    expect(await createCatalogFoodProductRequest("user-1", search)).toBe(
      "created",
    );
    expect(await createCatalogFoodProductRequest("user-1", search)).toBe(
      "already-requested",
    );
    expect(await hasOpenCatalogFoodProductRequest("user-1", search)).toBe(true);
    // 別のユーザーは、同じ条件でもリクエストできる
    expect(await createCatalogFoodProductRequest("user-2", search)).toBe(
      "created",
    );

    const rows = await db
      .select()
      .from(catalogFoodProductRequests)
      .where(eq(catalogFoodProductRequests.userId, "user-1"));
    expect(rows).toEqual([
      expect.objectContaining({
        searchQuery: toCatalogSearchQuery(search),
        label: "キーワード：まぐろ、種類：ウェット",
        completedAt: null,
      }),
    ]);
  });

  it("検索条件がなければリクエストしない", async () => {
    expect(await createCatalogFoodProductRequest("user-1", criteria({}))).toBe(
      "no-criteria",
    );
    expect(await db.select().from(catalogFoodProductRequests)).toEqual([]);
  });

  it("未完了のリクエストが上限に達したら、それ以上は作らない", async () => {
    for (let index = 0; index < MAX_OPEN_CATALOG_REQUESTS; index++) {
      expect(
        await createCatalogFoodProductRequest(
          "user-1",
          criteria({ q: `商品${index}` }),
        ),
      ).toBe("created");
    }
    expect(
      await createCatalogFoodProductRequest("user-1", criteria({ q: "追加" })),
    ).toBe("limit-reached");
    // ほかのユーザーには影響しない
    expect(
      await createCatalogFoodProductRequest("user-2", criteria({ q: "追加" })),
    ).toBe("created");
  });

  it("別の条件のリクエストが同時に送られても、上限を超えて作らない", async () => {
    for (let index = 0; index < MAX_OPEN_CATALOG_REQUESTS - 1; index++) {
      await createCatalogFoodProductRequest(
        "user-1",
        criteria({ q: `商品${index}` }),
      );
    }

    const results = await Promise.all([
      createCatalogFoodProductRequest("user-1", criteria({ q: "同時1" })),
      createCatalogFoodProductRequest("user-1", criteria({ q: "同時2" })),
    ]);

    expect(results.sort()).toEqual(["created", "limit-reached"]);
    expect(
      await db
        .select()
        .from(catalogFoodProductRequests)
        .where(eq(catalogFoodProductRequests.userId, "user-1")),
    ).toHaveLength(MAX_OPEN_CATALOG_REQUESTS);
  });
});

describe("completeCatalogFoodProductRequest", () => {
  async function requestId(userId: string, q: string) {
    await createCatalogFoodProductRequest(userId, criteria({ q }));
    const [row] = await db
      .select()
      .from(catalogFoodProductRequests)
      .where(eq(catalogFoodProductRequests.userId, userId));
    return row.id;
  }

  it("完了にし、リクエストしたユーザーだけに通知を作る", async () => {
    const id = await requestId("user-1", "まぐろ");

    expect(await completeCatalogFoodProductRequest(id)).toBe("completed");

    const [request] = await db
      .select()
      .from(catalogFoodProductRequests)
      .where(eq(catalogFoodProductRequests.id, id));
    expect(request.completedAt).toBeInstanceOf(Date);
    const rows = await db.select().from(notifications);
    expect(rows).toEqual([
      expect.objectContaining({
        catId: null,
        householdId: null,
        userId: "user-1",
        kind: "catalog_request_completed",
        referenceId: id,
        dedupeKey: `catalog_request_completed:${id}`,
        title: "共通のごはん商品のリクエストに対応しました",
        body: "リクエストした検索条件（キーワード：まぐろ）に対応しました。もう一度検索してみてください",
        url: "/food-products/search?q=%E3%81%BE%E3%81%90%E3%82%8D",
        status: "pending",
      }),
    ]);

    // 通知センターには、リクエストしたユーザーにだけ表示する
    const now = new Date(Date.now() + 60_000);
    expect(
      (await listPendingNotifications(now, { userId: "user-1" })).map(
        (notification) => notification.id,
      ),
    ).toEqual([rows[0].id]);
    expect(await listPendingNotifications(now, { userId: "user-2" })).toEqual(
      [],
    );
  });

  it("完了にしたリクエストをもう一度完了にしても、通知を重ねて作らない", async () => {
    const id = await requestId("user-1", "まぐろ");

    expect(await completeCatalogFoodProductRequest(id)).toBe("completed");
    expect(await completeCatalogFoodProductRequest(id)).toBe(
      "already-completed",
    );
    expect(await db.select().from(notifications)).toHaveLength(1);
    // 完了にした後は、同じ条件でもう一度リクエストできる
    expect(
      await createCatalogFoodProductRequest(
        "user-1",
        criteria({ q: "まぐろ" }),
      ),
    ).toBe("created");
  });

  it("存在しないリクエストは完了にしない", async () => {
    expect(await completeCatalogFoodProductRequest("missing")).toBe(
      "not-found",
    );
  });
});

describe("listCatalogFoodProductRequests", () => {
  it("未完了は古い順、完了は完了にした新しい順に返し、リクエストしたユーザーは返さない", async () => {
    await createCatalogFoodProductRequest("user-1", criteria({ q: "一" }));
    await createCatalogFoodProductRequest("user-2", criteria({ q: "二" }));
    await createCatalogFoodProductRequest("user-1", criteria({ q: "三" }));
    const open = await listCatalogFoodProductRequests("open");
    expect(open.items.map((request) => request.label)).toEqual([
      "キーワード：一",
      "キーワード：二",
      "キーワード：三",
    ]);
    expect(open.hasMore).toBe(false);
    expect(open.items[0]).not.toHaveProperty("userId");

    await completeCatalogFoodProductRequest(open.items[1].id);
    expect(
      (await listCatalogFoodProductRequests("open")).items.map(
        (request) => request.label,
      ),
    ).toEqual(["キーワード：一", "キーワード：三"]);
    expect(
      (await listCatalogFoodProductRequests("completed")).items.map(
        (request) => request.label,
      ),
    ).toEqual(["キーワード：二"]);
  });
});
