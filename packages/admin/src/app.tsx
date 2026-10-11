import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import {
  deleteUserSessions,
  getOverview,
  listHouseholds,
  listUsers,
} from "./db/queries";
import { Layout } from "./views/Layout";
import { HouseholdsPage, OverviewPage, UsersPage } from "./views/pages";

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
    const households = await listHouseholds(c.env.DB);
    return c.html(
      <Layout title="家" currentPath="/households">
        <HouseholdsPage households={households} />
      </Layout>,
    );
  });

  return app;
}
