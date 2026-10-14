import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import {
  EMPTY_INPUT,
  type FormBody,
  parseCatalogFoodProductForm,
  toInput,
} from "./catalog/form";
import { type CheckedImage, checkCatalogImage } from "./catalog/image";
import {
  createCatalogFoodProduct,
  deleteCatalogFoodProduct,
  getCatalogFoodProduct,
  getCatalogImage,
  listCatalogFoodProducts,
  updateCatalogFoodProduct,
} from "./db/catalogFoodProducts";
import {
  addHouseholdMember,
  deleteUserSessions,
  getOverview,
  listHouseholds,
  listUsers,
  removeHouseholdMember,
} from "./db/queries";
import {
  type CatalogChange,
  CatalogFoodProductFormPage,
  CatalogFoodProductsActions,
  CatalogFoodProductsPage,
} from "./views/catalogPages";
import { Layout } from "./views/Layout";
import {
  type HouseholdMemberChange,
  HouseholdsPage,
  OverviewPage,
  UsersPage,
} from "./views/pages";

const MEMBER_CHANGE_RESULTS = [
  "added",
  "removed",
  "add-failed",
  "remove-failed",
] as const satisfies readonly HouseholdMemberChange["result"][];

/** メンバーの追加・削除の結果を表示する `/households` の URL */
function householdsResultUrl(
  result: HouseholdMemberChange["result"],
  householdId: string,
  userId: string,
) {
  const params = new URLSearchParams({
    memberChange: result,
    household: householdId,
    user: userId,
  });
  return `/households?${params}`;
}

const CATALOG_CHANGE_RESULTS = ["created", "updated", "deleted"] as const;

/** 共通のごはん商品の登録・更新・削除の結果を表示する `/food-products` の URL */
function catalogResultUrl(
  result: (typeof CATALOG_CHANGE_RESULTS)[number],
  productId?: string,
) {
  const params = new URLSearchParams({ catalogChange: result });
  if (productId) {
    params.set("product", productId);
  }
  return `/food-products?${params}`;
}

/** 共通のごはん商品の登録・編集ページのパンくず（一覧へ戻れるようにする） */
function catalogBreadcrumb(label: string) {
  return [{ label: "共通のごはん商品", href: "/food-products" }, { label }];
}

/** 画像を選んでいれば検証する。選んでいなければ null */
async function checkImage(file: File | null): Promise<CheckedImage | null> {
  return file ? checkCatalogImage(file) : null;
}

/**
 * 管理画面のアプリ。アクセス制御は Cloudflare Access（管理者だけを許可する
 * Self-hosted アプリケーション）に任せ、アプリ内では認証しない
 * （docs/deploy.md の「管理画面」節）
 */
export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.use(secureHeaders());
  // Cloudflare Access の Cookie はほかのサイトからのフォーム送信にも付きうるため、
  // 書き込みを伴う POST は同じオリジンからのものだけを受け付ける
  app.use(csrf());
  app.use(async (c, next) => {
    await next();
    // 全ユーザー・全家の情報を含むため、ブラウザや中間のキャッシュに残さない
    c.header("Cache-Control", "no-store");
  });

  app.get("/", async (c) => {
    const overview = await getOverview(c.env.DB);
    return c.html(
      <Layout title="概要" currentPath="/">
        <OverviewPage overview={overview} />
      </Layout>,
    );
  });

  app.get("/users", async (c) => {
    const users = await listUsers(c.env.DB);
    // すべての端末からログアウトさせた直後は、対象のユーザーを結果として表示する
    const loggedOutUserId = c.req.query("loggedOut");
    const loggedOutUser = users.find((user) => user.id === loggedOutUserId);
    return c.html(
      <Layout title="ユーザー" currentPath="/users">
        <UsersPage users={users} loggedOutUser={loggedOutUser} />
      </Layout>,
    );
  });

  // ユーザーをすべての端末からログアウトさせる（ログインセッションをすべて削除する）
  app.post("/users/:userId/sessions/delete", async (c) => {
    const userId = c.req.param("userId");
    await deleteUserSessions(c.env.DB, userId);
    return c.redirect(`/users?loggedOut=${encodeURIComponent(userId)}`, 303);
  });

  app.get("/households", async (c) => {
    const [households, users] = await Promise.all([
      listHouseholds(c.env.DB),
      listUsers(c.env.DB),
    ]);
    // メンバーを追加・削除した直後は、その結果を表示する
    const result = MEMBER_CHANGE_RESULTS.find(
      (value) => value === c.req.query("memberChange"),
    );
    const household = households.find(
      (item) => item.id === c.req.query("household"),
    );
    const user = users.find((item) => item.id === c.req.query("user"));
    const memberChange =
      result && household && user ? { result, household, user } : undefined;
    return c.html(
      <Layout title="家" currentPath="/households">
        <HouseholdsPage
          households={households}
          users={users}
          memberChange={memberChange}
        />
      </Layout>,
    );
  });

  // ユーザーを家のメンバーとして追加する
  app.post("/households/:householdId/members", async (c) => {
    const householdId = c.req.param("householdId");
    const body = await c.req.parseBody();
    const userId = typeof body.userId === "string" ? body.userId : "";
    const result = await addHouseholdMember(c.env.DB, householdId, userId);
    return c.redirect(
      householdsResultUrl(
        result.ok ? "added" : "add-failed",
        householdId,
        userId,
      ),
      303,
    );
  });

  // ユーザーを家から外す（オーナーは外せない）
  app.post("/households/:householdId/members/:userId/delete", async (c) => {
    const householdId = c.req.param("householdId");
    const userId = c.req.param("userId");
    const result = await removeHouseholdMember(c.env.DB, householdId, userId);
    return c.redirect(
      householdsResultUrl(
        result.ok ? "removed" : "remove-failed",
        householdId,
        userId,
      ),
      303,
    );
  });

  app.get("/food-products", async (c) => {
    const products = await listCatalogFoodProducts(c.env.DB);
    // 登録・更新・削除した直後は、その結果を表示する
    const result = CATALOG_CHANGE_RESULTS.find(
      (value) => value === c.req.query("catalogChange"),
    );
    const product = products.find((item) => item.id === c.req.query("product"));
    const change: CatalogChange | undefined =
      result === "deleted"
        ? { result }
        : result && product
          ? { result, product }
          : undefined;
    return c.html(
      <Layout
        title="共通のごはん商品"
        currentPath="/food-products"
        actions={<CatalogFoodProductsActions />}
      >
        <CatalogFoodProductsPage products={products} change={change} />
      </Layout>,
    );
  });

  app.get("/food-products/new", (c) =>
    c.html(
      <Layout
        title="共通のごはん商品を登録する"
        currentPath="/food-products"
        breadcrumb={catalogBreadcrumb("登録する")}
      >
        <CatalogFoodProductFormPage input={EMPTY_INPUT} />
      </Layout>,
    ),
  );

  // 共通のごはん商品を登録する
  app.post("/food-products", async (c) => {
    const parsed = parseCatalogFoodProductForm(
      (await c.req.parseBody({ all: true })) as FormBody,
    );
    const image = parsed.ok ? await checkImage(parsed.image) : null;
    if (!parsed.ok || image?.ok === false) {
      return c.html(
        <Layout
          title="共通のごはん商品を登録する"
          currentPath="/food-products"
          breadcrumb={catalogBreadcrumb("登録する")}
        >
          <CatalogFoodProductFormPage
            input={parsed.ok ? toInput(parsed.values) : parsed.input}
            errors={
              parsed.ok
                ? { image: image?.ok === false ? image.error : undefined }
                : parsed.errors
            }
          />
        </Layout>,
        400,
      );
    }
    const id = await createCatalogFoodProduct(
      c.env.DB,
      c.env.MEDIA_BUCKET,
      parsed.values,
      image,
    );
    return c.redirect(catalogResultUrl("created", id), 303);
  });

  app.get("/food-products/:productId/edit", async (c) => {
    const product = await getCatalogFoodProduct(
      c.env.DB,
      c.req.param("productId"),
    );
    if (!product) {
      return c.notFound();
    }
    return c.html(
      <Layout
        title={`${product.name} を編集する`}
        currentPath="/food-products"
        breadcrumb={catalogBreadcrumb("編集する")}
      >
        <CatalogFoodProductFormPage
          product={product}
          input={toInput(product)}
        />
      </Layout>,
    );
  });

  // 共通のごはん商品を更新する（家に追加済みの商品には反映しない）
  app.post("/food-products/:productId", async (c) => {
    const productId = c.req.param("productId");
    const product = await getCatalogFoodProduct(c.env.DB, productId);
    if (!product) {
      return c.notFound();
    }
    const parsed = parseCatalogFoodProductForm(
      (await c.req.parseBody({ all: true })) as FormBody,
    );
    const image = parsed.ok ? await checkImage(parsed.image) : null;
    if (!parsed.ok || image?.ok === false) {
      return c.html(
        <Layout
          title={`${product.name} を編集する`}
          currentPath="/food-products"
          breadcrumb={catalogBreadcrumb("編集する")}
        >
          <CatalogFoodProductFormPage
            product={product}
            input={parsed.ok ? toInput(parsed.values) : parsed.input}
            errors={
              parsed.ok
                ? { image: image?.ok === false ? image.error : undefined }
                : parsed.errors
            }
          />
        </Layout>,
        400,
      );
    }
    const updated = await updateCatalogFoodProduct(
      c.env.DB,
      c.env.MEDIA_BUCKET,
      productId,
      parsed.values,
      { image, removeImage: parsed.removeImage },
    );
    if (!updated) {
      return c.notFound();
    }
    return c.redirect(catalogResultUrl("updated", productId), 303);
  });

  // 共通のごはん商品を削除する（家に追加済みの商品は残る）
  app.post("/food-products/:productId/delete", async (c) => {
    const deleted = await deleteCatalogFoodProduct(
      c.env.DB,
      c.env.MEDIA_BUCKET,
      c.req.param("productId"),
    );
    if (!deleted) {
      return c.notFound();
    }
    return c.redirect(catalogResultUrl("deleted"), 303);
  });

  // 共通のごはん商品の画像。管理画面の一覧・編集フォームで表示する
  app.get("/food-products/:productId/image", async (c) => {
    const image = await getCatalogImage(c.env.DB, c.req.param("productId"));
    const object = image ? await c.env.MEDIA_BUCKET.get(image.objectKey) : null;
    if (!image || !object) {
      return c.notFound();
    }
    return c.body(object.body, 200, { "Content-Type": image.mimeType });
  });

  return app;
}
