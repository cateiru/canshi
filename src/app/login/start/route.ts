import { getCloudflareContext } from "@opennextjs/cloudflare";
import { type NextRequest, NextResponse } from "next/server";
import {
  buildAuthorizationUrl,
  createOidcLoginState,
  encodeOidcLoginState,
  getOidcDiscoveryDocument,
  OIDC_CALLBACK_PATH,
  OIDC_STATE_COOKIE_NAME,
  OIDC_STATE_MAX_AGE_SECONDS,
  requireOidcConfig,
} from "@/features/auth/oidc";

export const dynamic = "force-dynamic";

/**
 * `/login` のログインボタンの送信先。state・nonce・PKCE の値を Cookie に保存し、
 * Cloudflare Access（SaaS OIDC アプリ）の認可エンドポイントへリダイレクトする。
 * Access でログインすると `/login/callback` に戻る
 */
export async function GET(request: NextRequest) {
  const { env } = getCloudflareContext();
  const config = requireOidcConfig(env);
  const discovery = await getOidcDiscoveryDocument(config.discoveryUrl);

  const loginState = createOidcLoginState(
    request.nextUrl.searchParams.get("callbackUrl") ?? "",
  );
  const authorizationUrl = await buildAuthorizationUrl({
    authorizationEndpoint: discovery.authorization_endpoint,
    clientId: config.clientId,
    redirectUri: new URL(OIDC_CALLBACK_PATH, request.nextUrl.origin).href,
    loginState,
  });

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(
    OIDC_STATE_COOKIE_NAME,
    encodeOidcLoginState(loginState),
    {
      httpOnly: true,
      // Access からの戻り（別サイトからのトップレベルの GET）でも Cookie を送るため Lax にする
      sameSite: "lax",
      secure: process.env.NODE_ENV !== "development",
      path: OIDC_CALLBACK_PATH,
      maxAge: OIDC_STATE_MAX_AGE_SECONDS,
    },
  );
  return response;
}
