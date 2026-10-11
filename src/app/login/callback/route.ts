import { getCloudflareContext } from "@opennextjs/cloudflare";
import { type NextRequest, NextResponse } from "next/server";
import { loginWithEmail } from "@/features/auth/login";
import {
  decodeOidcLoginState,
  exchangeAuthorizationCode,
  getOidcDiscoveryDocument,
  OIDC_CALLBACK_PATH,
  OIDC_STATE_COOKIE_NAME,
  requireOidcConfig,
  verifyIdToken,
} from "@/features/auth/oidc";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/features/auth/sessionToken";

export const dynamic = "force-dynamic";

/**
 * Cloudflare Access でログインしたあとの戻り先。認可コードを ID トークンに交換して
 * メールアドレスを確かめ、そのハッシュに対応するユーザー（いなければ新しく作る）の
 * セッションを作る。失敗したときは `/login` に戻し、エラーを表示する
 */
export async function GET(request: NextRequest) {
  const { env } = getCloudflareContext();
  const { searchParams, origin } = request.nextUrl;
  const loginState = decodeOidcLoginState(
    request.cookies.get(OIDC_STATE_COOKIE_NAME)?.value,
  );

  const failed = (reason: string, error?: unknown) => {
    console.error(`ログインに失敗しました: ${reason}`, error ?? "");
    const url = new URL("/login", origin);
    url.searchParams.set("error", "1");
    if (loginState) {
      url.searchParams.set("callbackUrl", loginState.callbackUrl);
    }
    const response = NextResponse.redirect(url);
    response.cookies.delete({
      name: OIDC_STATE_COOKIE_NAME,
      path: OIDC_CALLBACK_PATH,
    });
    return response;
  };

  if (!loginState) {
    return failed("state の Cookie がない、または期限切れです");
  }
  if (searchParams.get("error")) {
    return failed(`Access がエラーを返しました: ${searchParams.get("error")}`);
  }
  const code = searchParams.get("code");
  if (!code || searchParams.get("state") !== loginState.state) {
    return failed("認可コードがない、または state が一致しません");
  }

  let email: string;
  try {
    const config = requireOidcConfig(env);
    const discovery = await getOidcDiscoveryDocument(config.discoveryUrl);
    const idToken = await exchangeAuthorizationCode({
      tokenEndpoint: discovery.token_endpoint,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      redirectUri: new URL(OIDC_CALLBACK_PATH, origin).href,
      codeVerifier: loginState.codeVerifier,
    });
    ({ email } = await verifyIdToken(idToken, {
      issuer: discovery.issuer,
      jwksUri: discovery.jwks_uri,
      clientId: config.clientId,
      nonce: loginState.nonce,
    }));
  } catch (error) {
    return failed("ID トークンを取得・検証できませんでした", error);
  }

  const { token, expiresAt } = await loginWithEmail(email, env);
  const response = NextResponse.redirect(
    new URL(loginState.callbackUrl, origin),
  );
  response.cookies.set(
    SESSION_COOKIE_NAME,
    token,
    sessionCookieOptions(expiresAt),
  );
  response.cookies.delete({
    name: OIDC_STATE_COOKIE_NAME,
    path: OIDC_CALLBACK_PATH,
  });
  return response;
}
