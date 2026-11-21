import { beforeEach, describe, expect, it } from "vitest";
import type {
  CatalogFoodProductJson,
  CatalogFoodProductRequestsResponse,
  CatalogFoodProductsResponse,
  HouseholdDetailResponse,
  HouseholdsResponse,
  UserDetailResponse,
  UsersResponse,
} from "./api/types";
import { createApp } from "./app";
import { createMigratedDatabase, toD1 } from "./test/d1";
import { seed } from "./test/fixtures";
import { createJpeg } from "./test/jpeg";
import { createFakeBucket } from "./test/r2";

let env: Env;
let bucket: ReturnType<typeof createFakeBucket>;
/** 静的アセット（ビルドした SPA）に渡されたリクエストのパス */
let assetRequests: string[];

beforeEach(async () => {
  const database = await createMigratedDatabase();
  seed(database);
  bucket = createFakeBucket();
  assetRequests = [];
  env = {
    DB: toD1(database),
    MEDIA_BUCKET: bucket.bucket,
    ASSETS: {
      fetch: async (input: RequestInfo | URL) => {
        assetRequests.push(
          new URL(String(input instanceof Request ? input.url : input))
            .pathname,
        );
        return new Response('<!doctype html><div id="root"></div>', {
          headers: { "Content-Type": "text/html" },
        });
      },
    } as unknown as Fetcher,
  };
});

const ORIGIN = "https://admin.canshi.app";
const EVIL_ORIGIN = "https://evil.example.com";

function request(path: string, init: RequestInit = {}) {
  return createApp().request(`${ORIGIN}${path}`, init, env);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await request(path);
  expect(response.status).toBe(200);
  return (await response.json()) as T;
}

/** 管理画面からの書き込み（ブラウザは GET・HEAD 以外の送信に Origin を付ける） */
function send(
  method: "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  origin = ORIGIN,
) {
  return request(path, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function countSessions(userId: string) {
  const { results } = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?1",
  )
    .bind(userId)
    .all<{ count: number }>();
  return results[0].count;
}

describe("画面（静的アセット）", () => {
  it("API 以外のパスは静的アセット（SPA）に渡し、セキュリティのヘッダーを付ける", async () => {
    const response = await request("/users");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<div id="root">');
    expect(assetRequests).toEqual(["/users"]);
    expect(response.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("存在しない API は静的アセットに渡さず 404 にする", async () => {
    const response = await request("/api/missing");
    expect(response.status).toBe(404);
    expect(assetRequests).toEqual([]);
  });
});

describe("一覧の API", () => {
  it("概要に件数と、家に未所属の猫の数を返す", async () => {
    const response = await request("/api/overview");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      userCount: 3,
      householdCount: 2,
      catCount: expect.any(Number),
      unassignedCatCount: 1,
    });
  });

  it("ユーザー一覧に、権限・所属する家・有効なセッションを返し、トークンは返さない", async () => {
    const response = await request("/api/users");
    const text = await response.text();
    // セッションのトークン（ハッシュ）は返さない
    expect(text).not.toContain("hash-active-1");
    const { users } = JSON.parse(text) as UsersResponse;
    expect(users.map((user) => user.name)).toContain("たろう");
    // 利用者の入力した名前はそのまま返し、画面（React）がエスケープして表示する
    expect(users.map((user) => user.name)).toContain(
      "<script>alert(1)</script>",
    );
    const taro = users.find((user) => user.id === "user-1");
    expect(taro).toMatchObject({
      role: "admin",
      households: expect.arrayContaining([
        expect.objectContaining({ householdName: "わが家", role: "owner" }),
      ]),
    });
    // 日時は ISO 8601 の文字列にする
    expect(taro?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("家の一覧に、メンバーと猫の数と、追加の候補のユーザーを返す", async () => {
    const { households, users } =
      await getJson<HouseholdsResponse>("/api/households");
    const home = households.find((household) => household.id === "household-1");
    expect(home).toMatchObject({
      name: "わが家",
      members: [
        { userId: "user-1", userName: "たろう", role: "owner" },
        { userId: "user-2", role: "member" },
      ],
    });
    expect(users).toHaveLength(3);
  });
});

describe("詳細の API", () => {
  it("ユーザーの詳細に、所属する家と通知の購読を返し、トークン・購読の送り先と鍵は返さない", async () => {
    const response = await request("/api/users/user-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const text = await response.text();
    for (const secret of [
      "hash-active-1",
      "secret-endpoint",
      "secret-p256dh",
      "secret-auth",
    ]) {
      expect(text).not.toContain(secret);
    }
    const { user } = JSON.parse(text) as UserDetailResponse;
    expect(user).toMatchObject({
      name: "たろう",
      households: [
        { householdName: "わが家", role: "owner" },
        { householdName: "実家", role: "owner" },
      ],
      pushSubscriptions: [{ deviceName: "iPhone・Safari", failureCount: 2 }],
    });
    // テスト用データのセッションは実行時の日時では期限切れのため返さない
    expect(user.sessions).toEqual([]);
    expect(user.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("家の詳細に、メンバー・猫・招待と、追加の候補のユーザーを返し、招待のトークンは返さない", async () => {
    const response = await request("/api/households/household-1");
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain("invitation-hash");
    const { household, users } = JSON.parse(text) as HouseholdDetailResponse;
    expect(household).toMatchObject({
      name: "わが家",
      members: [
        { userId: "user-1", role: "owner" },
        { userId: "user-2", role: "member" },
      ],
      cats: [{ name: "みけ" }, { name: "くろ" }],
    });
    // 実行時の日時では、使われていない招待はどれも期限切れ
    expect(
      household.invitations.map((invitation) => invitation.status),
    ).toEqual(["expired", "accepted", "expired"]);
    expect(users).toEqual([
      { id: "user-1", name: "たろう" },
      { id: "user-2", name: "<script>alert(1)</script>" },
      { id: "user-3", name: "はなこ" },
    ]);
  });

  it("存在しないユーザー・家は 404 にする", async () => {
    for (const path of ["/api/users/missing", "/api/households/missing"]) {
      const response = await request(path);
      expect(response.status).toBe(404);
      expect(assetRequests).toEqual([]);
    }
  });
});

describe("すべての端末からログアウトさせる", () => {
  beforeEach(async () => {
    // API は実行時の日時で有効なセッションを数えるため、テスト用データ（2026-10-01 基準）の
    // セッションとは別に、期限が十分先のセッションを user-1 に作る
    const expiresAt = Math.floor(Date.now() / 1000) + 86_400;
    await env.DB.prepare(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('hash-current', 'user-1', ?1)",
    )
      .bind(expiresAt)
      .run();
  });

  it("有効なセッションの数を返す", async () => {
    const { users } = await getJson<UsersResponse>("/api/users");
    const counts = Object.fromEntries(
      users.map((user) => [user.id, user.activeSessionCount]),
    );
    // 期限切れのセッションしかないユーザー・セッションが無いユーザーは 0
    expect(counts).toEqual({ "user-1": 1, "user-2": 0, "user-3": 0 });
  });

  it("ユーザーの詳細に有効なセッションを返す", async () => {
    const { user } = await getJson<UserDetailResponse>("/api/users/user-1");
    expect(user.sessions).toEqual([
      {
        id: expect.any(String),
        deviceName: "不明な端末",
        createdAt: expect.any(String),
        expiresAt: expect.any(String),
      },
    ]);
  });

  it("ユーザーのセッションをすべて削除する", async () => {
    const response = await send("DELETE", "/api/users/user-1/sessions");
    expect(response.status).toBe(200);
    expect(await countSessions("user-1")).toBe(0);
    // ほかのユーザーのセッションは残る
    expect(await countSessions("user-3")).toBe(1);
  });

  it("ほかのオリジンからの送信は拒否し、セッションを削除しない", async () => {
    const response = await send(
      "DELETE",
      "/api/users/user-1/sessions",
      undefined,
      EVIL_ORIGIN,
    );
    expect(response.status).toBe(403);
    expect(await countSessions("user-1")).toBe(4);
  });

  it("Origin のない送信も拒否する", async () => {
    const response = await request("/api/users/user-1/sessions", {
      method: "DELETE",
    });
    expect(response.status).toBe(403);
    expect(await countSessions("user-1")).toBe(4);
  });
});

async function userRole(userId: string) {
  const { results } = await env.DB.prepare(
    "SELECT role FROM users WHERE id = ?1",
  )
    .bind(userId)
    .all<{ role: string }>();
  return results[0].role;
}

describe("ユーザーの権限の変更", () => {
  it("権限を変える", async () => {
    const response = await send("POST", "/api/users/user-3/role", {
      role: "admin",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(await userRole("user-3")).toBe("admin");
  });

  it("選べない権限には変えず、失敗を返す", async () => {
    const response = await send("POST", "/api/users/user-3/role", {
      role: "owner",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false });
    expect(await userRole("user-3")).toBe("member");
  });

  it("本文が JSON でなければ変えない", async () => {
    const response = await request("/api/users/user-3/role", {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "role=admin",
    });
    expect(response.status).toBe(400);
    expect(await userRole("user-3")).toBe("member");
  });

  it("ほかのオリジンからの送信は拒否し、権限を変えない", async () => {
    const response = await send(
      "POST",
      "/api/users/user-3/role",
      { role: "admin" },
      EVIL_ORIGIN,
    );
    expect(response.status).toBe(403);
    expect(await userRole("user-3")).toBe("member");
  });
});

async function householdRoles(householdId: string) {
  const { results } = await env.DB.prepare(
    "SELECT user_id, role FROM household_members WHERE household_id = ?1 ORDER BY user_id",
  )
    .bind(householdId)
    .all<{ user_id: string; role: string }>();
  return results.map((row) => `${row.user_id}:${row.role}`);
}

describe("家のメンバーの追加・削除", () => {
  it("ユーザーをメンバーとして追加する", async () => {
    const response = await send("POST", "/api/households/household-2/members", {
      userId: "user-3",
    });
    expect(response.status).toBe(200);
    expect(await householdRoles("household-2")).toEqual([
      "user-1:owner",
      "user-3:member",
    ]);
  });

  it("すでにメンバーのユーザーは追加せず、失敗を返す", async () => {
    const response = await send("POST", "/api/households/household-1/members", {
      userId: "user-1",
    });
    expect(response.status).toBe(400);
    expect(await householdRoles("household-1")).toEqual([
      "user-1:owner",
      "user-2:member",
    ]);
  });

  it("オーナー以外のメンバーを家から外す", async () => {
    const response = await send(
      "DELETE",
      "/api/households/household-1/members/user-2",
    );
    expect(response.status).toBe(200);
    expect(await householdRoles("household-1")).toEqual(["user-1:owner"]);
  });

  it("オーナーは外さず、失敗を返す", async () => {
    const response = await send(
      "DELETE",
      "/api/households/household-1/members/user-1",
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: expect.stringContaining("オーナーは外せない"),
    });
    expect(await householdRoles("household-1")).toEqual([
      "user-1:owner",
      "user-2:member",
    ]);
  });

  it("ほかのオリジンからの送信は拒否し、メンバーを変えない", async () => {
    const added = await send(
      "POST",
      "/api/households/household-2/members",
      { userId: "user-3" },
      EVIL_ORIGIN,
    );
    expect(added.status).toBe(403);
    const removed = await send(
      "DELETE",
      "/api/households/household-1/members/user-2",
      undefined,
      EVIL_ORIGIN,
    );
    expect(removed.status).toBe(403);
    expect(await householdRoles("household-1")).toEqual([
      "user-1:owner",
      "user-2:member",
    ]);
    expect(await householdRoles("household-2")).toEqual(["user-1:owner"]);
  });
});

describe("共通のごはん商品", () => {
  // ブラウザで切り抜いた形の JPEG（一辺 800px 以下の正方形・メタデータなし）
  const JPEG_BYTES = createJpeg(800, 800);

  function productForm(values: Record<string, string | string[]> = {}) {
    const form = new FormData();
    const fields: Record<string, string | string[]> = {
      name: "まぐろ味 カリカリ",
      manufacturer: "ねこフード",
      kcalPer100g: "380",
      packageAmountG: "500",
      packageUnit: "",
      nutritionType: "complete",
      textureType: "dry",
      lifeStages: ["senior", "adult"],
      targetBreed: "",
      ...values,
    };
    for (const [key, value] of Object.entries(fields)) {
      for (const item of Array.isArray(value) ? value : [value]) {
        form.append(key, item);
      }
    }
    return form;
  }

  function sendMultipart(
    method: "POST" | "PUT",
    path: string,
    body: FormData,
    origin = ORIGIN,
  ) {
    return request(`/api${path}`, {
      method,
      headers: { Origin: origin },
      body,
    });
  }

  async function getProduct(id: string) {
    const { product } = await getJson<{ product: CatalogFoodProductJson }>(
      `/api/food-products/${id}`,
    );
    return product;
  }

  async function listProducts() {
    const { results } = await env.DB.prepare(
      "SELECT * FROM catalog_food_products ORDER BY name",
    ).all<Record<string, unknown>>();
    return results;
  }

  async function listImages() {
    const { results } = await env.DB.prepare(
      "SELECT * FROM media_assets WHERE record_type = 'catalog_food_product'",
    ).all<Record<string, unknown>>();
    return results;
  }

  /** 画像付きで登録し、商品の ID を返す */
  async function createWithImage() {
    const form = productForm();
    form.append("image", new File([JPEG_BYTES], "photo.jpg"));
    const response = await sendMultipart("POST", "/food-products", form);
    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    return id;
  }

  it("商品がなければ空の一覧を返す", async () => {
    expect(
      await getJson<CatalogFoodProductsResponse>("/api/food-products"),
    ).toEqual({ products: [] });
  });

  it("画像付きで登録し、一覧で返す", async () => {
    const id = await createWithImage();

    expect(await listProducts()).toEqual([
      expect.objectContaining({
        id,
        name: "まぐろ味 カリカリ",
        manufacturer: "ねこフード",
        kcal_per_100g: 380,
        package_amount_g: 500,
        package_unit: null,
        nutrition_type: "complete",
        texture_type: "dry",
        // 選んだ順ではなく決まった順で保存する
        life_stages: '["adult","senior"]',
        target_breed: null,
        package_sizes: '[{"amountG":500,"unit":null}]',
      }),
    ]);
    const [image] = await listImages();
    expect(image).toMatchObject({
      record_id: id,
      cat_id: null,
      uploaded_by_user_id: null,
      thumbnail_object_key: null,
      mime_type: "image/jpeg",
      size_bytes: JPEG_BYTES.length,
    });
    expect(image.object_key).toBe(`catalog_food_product/${id}/${image.id}`);
    expect(bucket.objects.get(image.object_key as string)?.body).toEqual(
      JPEG_BYTES,
    );

    const { products } =
      await getJson<CatalogFoodProductsResponse>("/api/food-products");
    expect(products).toEqual([
      expect.objectContaining({
        id,
        name: "まぐろ味 カリカリ",
        lifeStages: ["adult", "senior"],
        imageAssetId: image.id,
        addedCount: 0,
      }),
    ]);

    const imageResponse = await request(`/api/food-products/${id}/image`);
    expect(imageResponse.status).toBe(200);
    expect(imageResponse.headers.get("Content-Type")).toBe("image/jpeg");
    expect(new Uint8Array(await imageResponse.arrayBuffer())).toEqual(
      JPEG_BYTES,
    );
  });

  it("内容量の候補を並べた順に登録し、先頭の候補を元の内容量の列にも書く", async () => {
    const response = await sendMultipart(
      "POST",
      "/food-products",
      productForm({
        // 空の行は捨て、単位の先頭の「1」は取り除く
        packageAmountG: ["70", "", "12.3", "1500"],
        packageUnit: ["", "", "1本", ""],
      }),
    );
    expect(response.status).toBe(201);
    const [product] = await listProducts();
    expect(product).toMatchObject({
      package_amount_g: 70,
      package_unit: null,
      package_sizes:
        '[{"amountG":70,"unit":null},{"amountG":12.3,"unit":"本"},{"amountG":1500,"unit":null}]',
    });

    expect((await getProduct(product.id as string)).packageSizes).toEqual([
      { amountG: 70, unit: null },
      { amountG: 12.3, unit: "本" },
      { amountG: 1500, unit: null },
    ]);
  });

  it("検索キーワードを登録し、返す", async () => {
    const response = await sendMultipart(
      "POST",
      "/food-products",
      productForm({ searchKeywords: "ちゅーる\nちゃおちゅーる" }),
    );
    expect(response.status).toBe(201);
    const [product] = await listProducts();
    expect(product.search_keywords).toBe('["ちゅーる","ちゃおちゅーる"]');
    expect((await getProduct(product.id as string)).searchKeywords).toEqual([
      "ちゅーる",
      "ちゃおちゅーる",
    ]);

    // 空にすると未設定に戻す
    const cleared = await sendMultipart(
      "PUT",
      `/food-products/${product.id}`,
      productForm({ searchKeywords: "" }),
    );
    expect(cleared.status).toBe(200);
    expect((await listProducts())[0].search_keywords).toBe("[]");
  });

  it("候補を追加する前に登録された商品は、元の内容量を候補として表示する", async () => {
    await env.DB.prepare(
      `INSERT INTO catalog_food_products
        (id, name, kcal_per_100g, package_amount_g, package_unit, nutrition_type, texture_type)
      VALUES ('legacy', 'むかしの商品', 380, 40, '袋', 'complete', 'wet')`,
    ).run();
    expect((await getProduct("legacy")).packageSizes).toEqual([
      { amountG: 40, unit: "袋" },
    ]);
  });

  it("古い管理画面が元の内容量の列だけを更新していたら、その値を先頭の候補として表示する", async () => {
    await env.DB.prepare(
      `INSERT INTO catalog_food_products
        (id, name, kcal_per_100g, package_amount_g, package_unit, nutrition_type, texture_type, package_sizes)
      VALUES ('edited', '古い管理画面で編集した商品', 380, 50, NULL, 'complete', 'wet',
        '[{"amountG":40,"unit":"袋"},{"amountG":160,"unit":null}]')`,
    ).run();
    const amounts = (await getProduct("edited")).packageSizes.map(
      (size) => size.amountG,
    );
    expect(amounts[0]).toBe(50);
    expect(amounts).not.toContain(40);
    expect(amounts).toContain(160);
  });

  it("内容量の候補が空・誤り・重複のときは登録しない", async () => {
    const cases = [
      [
        { packageAmountG: "", packageUnit: "" },
        "内容量（g）は0より大きい値を入力してください",
      ],
      [
        { packageAmountG: ["70", "abc"], packageUnit: ["", ""] },
        "内容量（g）は0より大きい値を入力してください",
      ],
      [
        { packageAmountG: ["70", "70"], packageUnit: ["袋", "1袋"] },
        "同じ内容量がすでにあります",
      ],
      [
        {
          packageAmountG: Array.from({ length: 11 }, (_, index) =>
            String(index + 1),
          ),
          packageUnit: Array.from({ length: 11 }, () => ""),
        },
        "内容量の候補は10件までです",
      ],
    ] as const;
    for (const [values, message] of cases) {
      const response = await sendMultipart(
        "POST",
        "/food-products",
        productForm({
          packageAmountG: [...values.packageAmountG],
          packageUnit: [...values.packageUnit],
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.text()).toContain(message);
    }
    expect(await listProducts()).toEqual([]);
  });

  it("入力に誤りがあるときは登録せず、入力値とエラーを返す", async () => {
    const response = await sendMultipart(
      "POST",
      "/food-products",
      productForm({
        name: " ",
        kcalPer100g: "0",
        manufacturer: "<b>メーカー</b>",
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      errors: {
        name: "商品名を入力してください",
        kcalPer100g: "カロリー（kcal/100g）は0より大きい値を入力してください",
      },
      input: { manufacturer: "<b>メーカー</b>" },
    });
    expect(await listProducts()).toEqual([]);
  });

  it("ブラウザで切り抜かれずに届いた画像・画像ではないファイルは登録せず、R2 にも置かない", async () => {
    const files = [
      // スクリプトが動かず、位置情報などの Exif を持ったまま届いた写真
      new File([createJpeg(4000, 3000, { exif: true })], "photo.jpg"),
      // 正方形ではない
      new File([createJpeg(800, 533)], "wide.jpg"),
      new File(["not an image"], "note.txt"),
    ];
    for (const file of files) {
      const form = productForm();
      form.append("image", file);
      const response = await sendMultipart("POST", "/food-products", form);
      expect(response.status).toBe(400);
      expect(await response.text()).toContain(
        "画像をブラウザで正方形に切り抜けませんでした",
      );
    }
    expect(await listProducts()).toEqual([]);
    expect(bucket.objects.size).toBe(0);
  });

  it("編集で内容と画像を差し替え、古い画像を R2 から削除する", async () => {
    const id = await createWithImage();
    const [oldImage] = await listImages();

    expect(await getProduct(id)).toMatchObject({
      name: "まぐろ味 カリカリ",
      imageAssetId: oldImage.id,
    });

    const form = productForm({ name: "かつお味 カリカリ", textureType: "wet" });
    const replacement = createJpeg(600, 600);
    form.append("image", new File([replacement], "photo2.jpg"));
    const response = await sendMultipart("PUT", `/food-products/${id}`, form);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id });

    expect(await listProducts()).toEqual([
      expect.objectContaining({
        name: "かつお味 カリカリ",
        texture_type: "wet",
      }),
    ]);
    const [newImage] = await listImages();
    expect(newImage).toMatchObject({
      mime_type: "image/jpeg",
      size_bytes: replacement.length,
    });
    expect(newImage.id).not.toBe(oldImage.id);
    expect(bucket.objects.has(oldImage.object_key as string)).toBe(false);
    expect(bucket.objects.has(newImage.object_key as string)).toBe(true);
  });

  it("差し替えでは、その時点の画像をすべて削除して 1 枚だけにする", async () => {
    const id = await createWithImage();
    // 同時に行われた別の差し替えで、先に画像の行が増えていた場合を再現する
    await bucket.bucket.put(`catalog_food_product/${id}/other`, JPEG_BYTES);
    await env.DB.prepare(
      `INSERT INTO media_assets (id, record_type, record_id, object_key, mime_type, size_bytes)
      VALUES ('other', 'catalog_food_product', ?1, ?2, 'image/jpeg', 1)`,
    )
      .bind(id, `catalog_food_product/${id}/other`)
      .run();

    const form = productForm();
    form.append("image", new File([createJpeg(300, 300)], "photo.jpg"));
    expect(
      (await sendMultipart("PUT", `/food-products/${id}`, form)).status,
    ).toBe(200);
    const images = await listImages();
    expect(images).toHaveLength(1);
    expect([...bucket.objects.keys()]).toEqual([images[0].object_key]);
  });

  it("差し替えでは、削除する今の画像の分を差し引いて保存容量の上限を確かめる", async () => {
    const id = await createWithImage();
    // 今の使用容量ちょうどを上限にする（同じ大きさの画像なら差し替えられる）
    env = {
      ...env,
      MEDIA_STORAGE_LIMIT_BYTES: String(JPEG_BYTES.length),
    } as Env;
    const sameSize = productForm();
    sameSize.append("image", new File([JPEG_BYTES], "photo.jpg"));
    expect(
      (await sendMultipart("PUT", `/food-products/${id}`, sameSize)).status,
    ).toBe(200);

    // 今の画像より大きい画像は、上限を超えるため差し替えない
    const larger = productForm();
    larger.append(
      "image",
      new File([createJpeg(800, 800, { padding: 100 })], "large.jpg"),
    );
    expect(
      (await sendMultipart("PUT", `/food-products/${id}`, larger)).status,
    ).toBe(507);
    expect(await listImages()).toHaveLength(1);
  });

  it("保存容量の上限を超えるときは画像を保存せず、理由を返す", async () => {
    env = { ...env, MEDIA_STORAGE_LIMIT_BYTES: "10" } as Env;
    const form = productForm();
    form.append("image", new File([JPEG_BYTES], "photo.jpg"));
    const response = await sendMultipart("POST", "/food-products", form);
    expect(response.status).toBe(507);
    expect(await response.text()).toContain("保存容量の上限を超えるため");
    expect(await listProducts()).toEqual([]);
    expect(bucket.objects.size).toBe(0);
  });

  it("編集で画像の削除を選ぶと、画像を削除する", async () => {
    const id = await createWithImage();
    const response = await sendMultipart(
      "PUT",
      `/food-products/${id}`,
      productForm({ removeImage: "1" }),
    );
    expect(response.status).toBe(200);
    expect(await listImages()).toEqual([]);
    expect(bucket.objects.size).toBe(0);
  });

  it("削除しても家に追加済みの商品は残し、追加元だけを外す", async () => {
    const id = await createWithImage();
    await env.DB.prepare(
      `INSERT INTO food_products
        (id, household_id, name, kcal_per_100g, package_amount_g, nutrition_type,
         texture_type, catalog_food_product_id)
      VALUES ('food-1', 'household-1', 'まぐろ味 カリカリ', 380, 500, 'complete', 'dry', ?1)`,
    )
      .bind(id)
      .run();
    expect((await getProduct(id)).addedCount).toBe(1);

    const response = await send("DELETE", `/api/food-products/${id}`);
    expect(response.status).toBe(200);
    expect(await listProducts()).toEqual([]);
    expect(await listImages()).toEqual([]);
    expect(bucket.objects.size).toBe(0);
    const { results } = await env.DB.prepare(
      "SELECT catalog_food_product_id FROM food_products WHERE id = 'food-1'",
    ).all<{ catalog_food_product_id: string | null }>();
    expect(results).toEqual([{ catalog_food_product_id: null }]);
  });

  it("R2 から画像を削除できなかったときは、商品と画像の行を残す", async () => {
    const id = await createWithImage();
    bucket.state.failDelete = true;
    const response = await send("DELETE", `/api/food-products/${id}`);
    expect(response.status).toBe(500);
    expect(await listProducts()).toHaveLength(1);
    expect(await listImages()).toHaveLength(1);
  });

  it("存在しない商品は 404 にする", async () => {
    expect((await request("/api/food-products/missing")).status).toBe(404);
    expect((await request("/api/food-products/missing/image")).status).toBe(
      404,
    );
    expect(
      (await sendMultipart("PUT", "/food-products/missing", productForm()))
        .status,
    ).toBe(404);
    expect((await send("DELETE", "/api/food-products/missing")).status).toBe(
      404,
    );
  });

  it("ほかのオリジンからの送信は拒否し、登録しない", async () => {
    const response = await sendMultipart(
      "POST",
      "/food-products",
      productForm(),
      EVIL_ORIGIN,
    );
    expect(response.status).toBe(403);
    expect(await listProducts()).toEqual([]);
  });
});

describe("共通のごはん商品のリクエスト", () => {
  async function insertRequest(
    id: string,
    userId: string,
    label: string,
    completedAt: number | null = null,
  ) {
    await env.DB.prepare(
      `INSERT INTO catalog_food_product_requests
        (id, user_id, search_query, label, completed_at, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, unixepoch())`,
    )
      .bind(id, userId, "q=%E3%81%BE%E3%81%90%E3%82%8D", label, completedAt)
      .run();
  }

  async function listNotifications() {
    const { results } = await env.DB.prepare(
      "SELECT cat_id, household_id, user_id, kind, reference_id, dedupe_key, title, body, url, status FROM notifications",
    ).all();
    return results;
  }

  it("対応を待っているリクエストと完了にしたリクエストを分けて返す", async () => {
    await insertRequest("request-1", "user-2", "キーワード：<b>まぐろ</b>");
    await insertRequest("request-2", "user-3", "キーワード：かつお", 1);

    const body = await getJson<CatalogFoodProductRequestsResponse>(
      "/api/food-product-requests",
    );
    expect(body.open).toEqual([
      expect.objectContaining({
        id: "request-1",
        label: "キーワード：<b>まぐろ</b>",
        userName: "<script>alert(1)</script>",
        completedAt: null,
      }),
    ]);
    expect(body.completed).toEqual([
      expect.objectContaining({ id: "request-2", label: "キーワード：かつお" }),
    ]);
  });

  it("リクエストがなければ空の一覧を返す", async () => {
    expect(
      await getJson<CatalogFoodProductRequestsResponse>(
        "/api/food-product-requests",
      ),
    ).toEqual({ open: [], completed: [] });
  });

  it("完了にすると、リクエストしたユーザーだけに通知を作る", async () => {
    await insertRequest("request-1", "user-3", "キーワード：まぐろ");

    const response = await send(
      "POST",
      "/api/food-product-requests/request-1/complete",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ result: "completed" });
    expect(await listNotifications()).toEqual([
      {
        cat_id: null,
        household_id: null,
        user_id: "user-3",
        kind: "catalog_request_completed",
        reference_id: "request-1",
        dedupe_key: "catalog_request_completed:request-1",
        // メインアプリの `catalogRequestCompletedMessage` と同じ文言・URL
        title: "共通のごはん商品のリクエストに対応しました",
        body: "リクエストした検索条件（キーワード：まぐろ）に対応しました。もう一度検索してみてください",
        url: "/food-products/search?q=%E3%81%BE%E3%81%90%E3%82%8D",
        status: "pending",
      },
    ]);

    const { open } = await getJson<CatalogFoodProductRequestsResponse>(
      "/api/food-product-requests",
    );
    expect(open).toEqual([]);
  });

  it("完了にしたリクエストをもう一度完了にしても、通知を重ねて作らない", async () => {
    await insertRequest("request-1", "user-3", "キーワード：まぐろ");

    await send("POST", "/api/food-product-requests/request-1/complete");
    const response = await send(
      "POST",
      "/api/food-product-requests/request-1/complete",
    );
    expect(await response.json()).toEqual({ result: "already-completed" });
    expect(await listNotifications()).toHaveLength(1);
  });

  it("存在しないリクエストは 404 にし、ほかのオリジンからの送信は断る", async () => {
    expect(
      (await send("POST", "/api/food-product-requests/missing/complete"))
        .status,
    ).toBe(404);

    await insertRequest("request-1", "user-3", "キーワード：まぐろ");
    const response = await send(
      "POST",
      "/api/food-product-requests/request-1/complete",
      undefined,
      EVIL_ORIGIN,
    );
    expect(response.status).toBe(403);
    expect(await listNotifications()).toEqual([]);
  });
});
