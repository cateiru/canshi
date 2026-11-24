/*
 * API（`/api/v1`）のエンドポイントの一覧。業務の処理は、AI との接続と共通の操作
 * （`src/features/external-access/presentation/operations/`）で、ここでは HTTP のメソッド・パスと
 * 操作の対応だけを持つ。ルーティング・引数の検証・仕様（OpenAPI）の生成は、この一覧をもとに
 * Hono（`@hono/zod-openapi`）で行う（`../presentation/app.ts`）。
 * すべての操作に 1 つずつエンドポイントがあることは、テストで確かめる
 */

export const API_BASE_PATH = "/api/v1";

/** API の仕様（OpenAPI）を返すパス。トークンなしで読める */
export const API_OPENAPI_PATH = "/openapi.json";

export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRoute {
  method: ApiMethod;
  /** `API_BASE_PATH` より後ろのパス。`{catId}` のような部分は、同じ名前の操作の引数になる */
  path: string;
  /** 呼び出す操作の名前 */
  operation: string;
  /** 成功したときの HTTP ステータス */
  successStatus: 200 | 201;
  /** ヘルプ・API の仕様に表示する、エンドポイントの説明 */
  summary: string;
}

export interface ApiRouteGroup {
  label: string;
  routes: ApiRoute[];
}

function get(path: string, operation: string, summary: string): ApiRoute {
  return { method: "GET", path, operation, successStatus: 200, summary };
}

function create(path: string, operation: string, summary: string): ApiRoute {
  return { method: "POST", path, operation, successStatus: 201, summary };
}

function update(path: string, operation: string, summary: string): ApiRoute {
  return { method: "PATCH", path, operation, successStatus: 200, summary };
}

function remove(path: string, operation: string, summary: string): ApiRoute {
  return { method: "DELETE", path, operation, successStatus: 200, summary };
}

/** 記録の種類ごとの、パスと操作の名前の一部 */
const RECORD_ROUTES = [
  { path: "feeding-records", name: "feeding_record", label: "ごはんの記録" },
  { path: "poop-records", name: "poop_record", label: "うんちの記録" },
  { path: "weight-records", name: "weight_record", label: "体重の記録" },
  { path: "vomit-records", name: "vomit_record", label: "嘔吐の記録" },
  { path: "water-records", name: "water_record", label: "飲水の記録" },
  {
    path: "shampoo-records",
    name: "shampoo_record",
    label: "シャンプーの記録",
  },
  {
    path: "brushing-records",
    name: "brushing_record",
    label: "ブラッシングの記録",
  },
  { path: "cleaning-records", name: "cleaning_record", label: "掃除の記録" },
  { path: "symptoms", name: "symptom", label: "症状の記録" },
  { path: "medication-doses", name: "medication_dose", label: "投薬の記録" },
  { path: "hospital-visits", name: "hospital_visit", label: "通院の記録" },
  { path: "expenses", name: "expense", label: "支出の記録" },
  { path: "memos", name: "memo", label: "メモ" },
];

export const API_ROUTE_GROUPS: ApiRouteGroup[] = [
  {
    label: "ねこ",
    routes: [
      get("/cats", "list_cats", "ねこの一覧を取得"),
      create("/cats", "create_cat", "ねこを追加"),
      get("/cats/{catId}", "get_cat_profile", "ねこのプロフィールを取得"),
      update("/cats/{catId}", "update_cat", "ねこのプロフィールを編集"),
      get(
        "/cats/{catId}/notification-settings",
        "get_cat_notification_settings",
        "ねこの通知の設定を取得",
      ),
      update(
        "/cats/{catId}/notification-settings",
        "update_cat_notification_settings",
        "ねこの通知の設定を変更",
      ),
    ],
  },
  {
    label: "記録",
    routes: [
      get("/cats/{catId}/timeline", "list_timeline", "タイムラインを取得"),
      get("/cats/{catId}/memos", "list_memos", "メモの一覧を取得"),
      get(
        "/cats/{catId}/cleaning-targets",
        "list_cleaning_targets",
        "掃除対象の一覧を取得",
      ),
      get(
        "/cats/{catId}/medications",
        "list_medications",
        "服薬予定の一覧を取得",
      ),
      ...RECORD_ROUTES.flatMap(({ path, name, label }) => [
        create(`/cats/{catId}/${path}`, `create_${name}`, `${label}を追加`),
        update(
          `/cats/{catId}/${path}/{id}`,
          `update_${name}`,
          `${label}を編集`,
        ),
      ]),
    ],
  },
  {
    label: "家",
    routes: [
      get("/households", "list_households", "家の一覧を取得"),
      update("/households/{householdId}", "update_household", "家の名前を変更"),
      get(
        "/households/{householdId}/members",
        "list_household_members",
        "家のメンバーの一覧を取得",
      ),
      remove(
        "/households/{householdId}/members/{userId}",
        "remove_household_member",
        "家のメンバーを外す",
      ),
      {
        method: "PUT",
        path: "/households/{householdId}/owner",
        operation: "transfer_household_ownership",
        successStatus: 200,
        summary: "家のオーナーを移譲",
      },
      get(
        "/households/{householdId}/invitations",
        "list_household_invitations",
        "家への招待の一覧を取得",
      ),
      create(
        "/households/{householdId}/invitations",
        "create_household_invitation",
        "家への招待 URL を発行",
      ),
      remove(
        "/households/{householdId}/invitations/{invitationId}",
        "revoke_household_invitation",
        "家への招待を無効化",
      ),
    ],
  },
  {
    label: "ごはんの設定",
    routes: [
      get("/food-products", "list_food_products", "ごはん商品の一覧を取得"),
      create("/food-products", "create_food_product", "ごはん商品を追加"),
      update("/food-products/{id}", "update_food_product", "ごはん商品を編集"),
      get(
        "/feeding-presets",
        "list_feeding_presets",
        "ごはんプリセットの一覧を取得",
      ),
      create(
        "/feeding-presets",
        "create_feeding_preset",
        "ごはんプリセットを追加",
      ),
      update(
        "/feeding-presets/{id}",
        "update_feeding_preset",
        "ごはんプリセットを編集",
      ),
      remove(
        "/feeding-presets/{id}",
        "delete_feeding_preset",
        "ごはんプリセットを削除",
      ),
      get(
        "/feeding-schedules",
        "list_feeding_schedules",
        "ごはんの時間の一覧を取得",
      ),
      create(
        "/feeding-schedules",
        "create_feeding_schedule",
        "ごはんの時間を追加",
      ),
      update(
        "/feeding-schedules/{id}",
        "update_feeding_schedule",
        "ごはんの時間の通知の設定を変更",
      ),
      remove(
        "/feeding-schedules/{id}",
        "delete_feeding_schedule",
        "ごはんの時間を削除",
      ),
    ],
  },
  {
    label: "共通のごはん商品（管理者のみ）",
    routes: [
      get(
        "/catalog-food-products",
        "list_catalog_food_products",
        "共通のごはん商品を検索",
      ),
      create(
        "/catalog-food-products",
        "create_catalog_food_product",
        "共通のごはん商品を追加",
      ),
      update(
        "/catalog-food-products/{id}",
        "update_catalog_food_product",
        "共通のごはん商品を編集",
      ),
      get(
        "/catalog-food-product-requests",
        "list_catalog_food_product_requests",
        "共通のごはん商品のリクエストの一覧を取得",
      ),
      {
        method: "POST",
        path: "/catalog-food-product-requests/{id}/complete",
        operation: "complete_catalog_food_product_request",
        successStatus: 200,
        summary: "共通のごはん商品のリクエストを完了にする",
      },
    ],
  },
];

export const API_ROUTES: ApiRoute[] = API_ROUTE_GROUPS.flatMap(
  (group) => group.routes,
);

/** パスの `{catId}` のような部分の名前 */
export function apiPathParams(path: string): string[] {
  return [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
}
