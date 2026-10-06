import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { JWTVerifyGetKey } from "jose";
import { type AdminEnv, requireAccess } from "./auth/access";
import { getOverview, listHouseholds, listUsers } from "./db/queries";
import { Layout } from "./views/Layout";
import { HouseholdsPage, OverviewPage, UsersPage } from "./views/pages";

/**
 * 管理画面のアプリ。
 *
 * @param options.jwks テスト用に Access の JWT を検証する鍵を差し替える
 */
export function createApp(options?: { jwks?: JWTVerifyGetKey }) {
  const app = new Hono<AdminEnv>();

  app.use(secureHeaders());
  app.use(async (c, next) => {
    await next();
    // 全ユーザー・全家の情報を含むため、ブラウザや中間のキャッシュに残さない
    c.header("Cache-Control", "no-store");
  });
  app.use(requireAccess({ jwks: options?.jwks }));

  app.get("/", async (c) => {
    const overview = await getOverview(c.env.DB);
    return c.html(
      <Layout title="概要" currentPath="/" adminEmail={c.var.adminEmail}>
        <OverviewPage overview={overview} />
      </Layout>,
    );
  });

  app.get("/users", async (c) => {
    const users = await listUsers(c.env.DB);
    return c.html(
      <Layout
        title="ユーザー"
        currentPath="/users"
        adminEmail={c.var.adminEmail}
      >
        <UsersPage users={users} />
      </Layout>,
    );
  });

  app.get("/households", async (c) => {
    const households = await listHouseholds(c.env.DB);
    return c.html(
      <Layout
        title="家"
        currentPath="/households"
        adminEmail={c.var.adminEmail}
      >
        <HouseholdsPage households={households} />
      </Layout>,
    );
  });

  return app;
}
