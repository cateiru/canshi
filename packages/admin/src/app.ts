import { type Context, Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type {
  CatalogFoodProductInvalidResponse,
  CatalogFoodProductRequestsResponse,
  CatalogFoodProductResponse,
  CatalogFoodProductSavedResponse,
  CatalogFoodProductsResponse,
  ChangeResponse,
  CompleteRequestResponse,
  ErrorResponse,
  HouseholdDetailResponse,
  HouseholdsResponse,
  Json,
  OverviewResponse,
  UserDetailResponse,
  UsersResponse,
} from "./api/types";
import {
  type CatalogFoodProductErrors,
  type FormBody,
  type ParsedCatalogFoodProductForm,
  parseCatalogFoodProductForm,
  toInput,
} from "./catalog/form";
import { type CheckedImage, checkCatalogImage } from "./catalog/image";
import { resolveStorageLimitBytes } from "./catalog/storage";
import {
  completeCatalogFoodProductRequest,
  listCatalogFoodProductRequests,
} from "./db/catalogFoodProductRequests";
import {
  createCatalogFoodProduct,
  deleteCatalogFoodProduct,
  getCatalogFoodProduct,
  getCatalogImage,
  listCatalogFoodProducts,
  StorageLimitError,
  updateCatalogFoodProduct,
} from "./db/catalogFoodProducts";
import { type AdminDb, createAdminDb } from "./db/client";
import {
  addHouseholdMember,
  deleteUserSessions,
  getHouseholdDetail,
  getOverview,
  getUserDetail,
  listHouseholds,
  listUserOptions,
  listUsers,
  removeHouseholdMember,
  updateUserRole,
} from "./db/queries";

type AppEnv = { Bindings: Env; Variables: { db: AdminDb } };

/**
 * 値を JSON の型にする。日時（`Date`）は `c.json` が文字列にするため、型だけを合わせる
 * （`api/types.ts` の `Json`）
 */
function toJson<T>(value: T): Json<T> {
  return value as unknown as Json<T>;
}

function notFound(c: Context<AppEnv>, error = "見つかりませんでした") {
  return c.json<ErrorResponse>({ error }, 404);
}

/** JSON の本文のうち、文字列の項目を読む。本文が JSON でない・項目が文字列でないときは空文字列 */
async function readJsonText(c: Context<AppEnv>, key: string) {
  const body: unknown = await c.req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return "";
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

/** 画像を選んでいれば検証する。選んでいなければ null */
async function checkImage(file: File | null): Promise<CheckedImage | null> {
  return file ? checkCatalogImage(file) : null;
}

/** 共通のごはん商品の登録・更新で、入力に誤りがあるときの応答 */
function invalidCatalogInput(
  c: Context<AppEnv>,
  parsed: ParsedCatalogFoodProductForm,
  errors: CatalogFoodProductErrors,
  status: 400 | 507,
) {
  return c.json<CatalogFoodProductInvalidResponse>(
    {
      errors,
      input: parsed.ok ? toInput(parsed.values) : parsed.input,
    },
    status,
  );
}

/**
 * 管理画面の JSON の API（`/api/*`）。画面（`client/`）は Vite でビルドした React の SPA で、
 * Workers の静的アセットとして配信し、この API を呼んで表示・書き込みを行う
 */
function createApi() {
  const api = new Hono<AppEnv>();

  api.get("/overview", async (c) =>
    c.json<OverviewResponse>(await getOverview(c.var.db)),
  );

  api.get("/users", async (c) => {
    const users = await listUsers(c.var.db);
    return c.json<UsersResponse>({ users: toJson(users) });
  });

  api.get("/users/:userId", async (c) => {
    const user = await getUserDetail(c.var.db, c.req.param("userId"));
    if (!user) {
      return notFound(c, "ユーザーが見つかりませんでした");
    }
    return c.json<UserDetailResponse>({ user: toJson(user) });
  });

  // ユーザーのアプリ全体の権限を変える
  api.post("/users/:userId/role", async (c) => {
    const role = await readJsonText(c, "role");
    const result = await updateUserRole(c.var.db, c.req.param("userId"), role);
    return c.json<ChangeResponse>(result, result.ok ? 200 : 400);
  });

  // ユーザーをすべての端末からログアウトさせる（ログインセッションをすべて削除する）
  api.delete("/users/:userId/sessions", async (c) => {
    await deleteUserSessions(c.var.db, c.req.param("userId"));
    return c.json<ChangeResponse>({ ok: true });
  });

  api.get("/households", async (c) => {
    const households = await listHouseholds(c.var.db);
    return c.json<HouseholdsResponse>({ households: toJson(households) });
  });

  api.get("/households/:householdId", async (c) => {
    const [household, users] = await Promise.all([
      getHouseholdDetail(c.var.db, c.req.param("householdId")),
      listUserOptions(c.var.db),
    ]);
    if (!household) {
      return notFound(c, "家が見つかりませんでした");
    }
    return c.json<HouseholdDetailResponse>({
      household: toJson(household),
      users,
    });
  });

  // ユーザーを家のメンバーとして追加する
  api.post("/households/:householdId/members", async (c) => {
    const userId = await readJsonText(c, "userId");
    const result = await addHouseholdMember(
      c.var.db,
      c.req.param("householdId"),
      userId,
    );
    return c.json<ChangeResponse>(result, result.ok ? 200 : 400);
  });

  // ユーザーを家から外す（オーナーは外せない）
  api.delete("/households/:householdId/members/:userId", async (c) => {
    const result = await removeHouseholdMember(
      c.var.db,
      c.req.param("householdId"),
      c.req.param("userId"),
    );
    return c.json<ChangeResponse>(result, result.ok ? 200 : 400);
  });

  api.get("/food-products", async (c) => {
    const products = await listCatalogFoodProducts(c.var.db);
    return c.json<CatalogFoodProductsResponse>({ products: toJson(products) });
  });

  // 共通のごはん商品を登録する（multipart/form-data。項目は catalog/form.ts を参照）
  api.post("/food-products", async (c) => {
    const parsed = parseCatalogFoodProductForm(
      (await c.req.parseBody({ all: true })) as FormBody,
    );
    if (!parsed.ok) {
      return invalidCatalogInput(c, parsed, parsed.errors, 400);
    }
    const image = await checkImage(parsed.image);
    if (image?.ok === false) {
      return invalidCatalogInput(c, parsed, { image: image.error }, 400);
    }
    try {
      const id = await createCatalogFoodProduct(
        c.var.db,
        c.env.MEDIA_BUCKET,
        parsed.values,
        image,
        resolveStorageLimitBytes(c.env),
      );
      return c.json<CatalogFoodProductSavedResponse>({ id }, 201);
    } catch (error) {
      if (error instanceof StorageLimitError) {
        return invalidCatalogInput(c, parsed, { image: error.message }, 507);
      }
      throw error;
    }
  });

  api.get("/food-products/:productId", async (c) => {
    const product = await getCatalogFoodProduct(
      c.var.db,
      c.req.param("productId"),
    );
    if (!product) {
      return notFound(c, "共通のごはん商品が見つかりませんでした");
    }
    return c.json<CatalogFoodProductResponse>({ product: toJson(product) });
  });

  // 共通のごはん商品を更新する（家に追加済みの商品には反映しない）
  api.put("/food-products/:productId", async (c) => {
    const productId = c.req.param("productId");
    const parsed = parseCatalogFoodProductForm(
      (await c.req.parseBody({ all: true })) as FormBody,
    );
    if (!parsed.ok) {
      return invalidCatalogInput(c, parsed, parsed.errors, 400);
    }
    const image = await checkImage(parsed.image);
    if (image?.ok === false) {
      return invalidCatalogInput(c, parsed, { image: image.error }, 400);
    }
    try {
      const updated = await updateCatalogFoodProduct(
        c.var.db,
        c.env.MEDIA_BUCKET,
        productId,
        parsed.values,
        {
          image,
          removeImage: parsed.removeImage,
          storageLimitBytes: resolveStorageLimitBytes(c.env),
        },
      );
      if (!updated) {
        return notFound(c, "共通のごはん商品が見つかりませんでした");
      }
      return c.json<CatalogFoodProductSavedResponse>({ id: productId });
    } catch (error) {
      if (error instanceof StorageLimitError) {
        return invalidCatalogInput(c, parsed, { image: error.message }, 507);
      }
      throw error;
    }
  });

  // 共通のごはん商品を削除する（家に追加済みの商品は残る）
  api.delete("/food-products/:productId", async (c) => {
    const deleted = await deleteCatalogFoodProduct(
      c.var.db,
      c.env.MEDIA_BUCKET,
      c.req.param("productId"),
    );
    if (!deleted) {
      return notFound(c, "共通のごはん商品が見つかりませんでした");
    }
    return c.json<ChangeResponse>({ ok: true });
  });

  // 共通のごはん商品の画像。一覧・編集フォームで表示する
  api.get("/food-products/:productId/image", async (c) => {
    const image = await getCatalogImage(c.var.db, c.req.param("productId"));
    const object = image ? await c.env.MEDIA_BUCKET.get(image.objectKey) : null;
    if (!image || !object) {
      return notFound(c);
    }
    return c.body(object.body, 200, { "Content-Type": image.mimeType });
  });

  api.get("/food-product-requests", async (c) => {
    const { open, completed } = await listCatalogFoodProductRequests(c.var.db);
    return c.json<CatalogFoodProductRequestsResponse>({
      open: toJson(open),
      completed: toJson(completed),
    });
  });

  // リクエストを完了にし、リクエストしたユーザーに通知する
  api.post("/food-product-requests/:requestId/complete", async (c) => {
    const result = await completeCatalogFoodProductRequest(
      c.var.db,
      c.req.param("requestId"),
    );
    if (result === "not-found") {
      return notFound(c, "リクエストが見つかりませんでした");
    }
    return c.json<CompleteRequestResponse>({ result });
  });

  return api;
}

/**
 * 管理画面のアプリ。アクセス制御は Cloudflare Access（管理者だけを許可する
 * Self-hosted アプリケーション）に任せ、アプリ内では認証しない
 * （docs/deploy.md の「管理画面」節）。
 *
 * すべてのリクエストをこの Worker が受け（`wrangler.jsonc` の `assets.run_worker_first`）、
 * `/api/*` は API で、それ以外は静的アセット（ビルドした SPA）で返す。静的アセットにない
 * パス（`/users` など）は SPA の index.html を返す（`not_found_handling`）
 */
export function createApp() {
  const app = new Hono<AppEnv>();

  app.use(secureHeaders());

  app.use("/api/*", async (c, next) => {
    // Cloudflare Access の Cookie はほかのサイトからの送信にも付きうるため、書き込み
    // （GET・HEAD 以外）は同じオリジンの画面からのものだけを受け付ける。ブラウザは GET・HEAD
    // 以外の送信には、同じオリジンでも Origin を付ける
    const method = c.req.method;
    if (
      method !== "GET" &&
      method !== "HEAD" &&
      c.req.header("Origin") !== new URL(c.req.url).origin
    ) {
      return c.json<ErrorResponse>(
        { error: "ほかのサイトからの送信は受け付けません" },
        403,
      );
    }
    c.set("db", createAdminDb(c.env.DB));
    await next();
    // 全ユーザー・全家の情報を含むため、ブラウザや中間のキャッシュに残さない
    c.header("Cache-Control", "no-store");
  });

  app.route("/api", createApi());
  // 存在しない API は、SPA の index.html ではなく 404 の JSON にする
  app.all("/api/*", (c) => notFound(c));

  app.all("*", async (c) => {
    // 静的アセットの応答のヘッダーは書き換えられないため、作り直して secureHeaders を付けられるようにする
    const response = await c.env.ASSETS.fetch(c.req.raw);
    return new Response(response.body, response);
  });

  return app;
}
