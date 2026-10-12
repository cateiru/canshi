import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import {
  addHouseholdMember,
  deleteUserSessions,
  getOverview,
  listHouseholds,
  listUsers,
  removeHouseholdMember,
} from "./db/queries";
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

  return app;
}
