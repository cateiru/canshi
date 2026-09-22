import type { ClientInfo } from "@cloudflare/workers-oauth-provider";
import { signData, verifySignature } from "./oauth-state";

/**
 * `/authorize` のクライアント承認ダイアログ・CSRF 対策・承認済みクライアントの
 * 記憶（Cookie）。
 *
 * DCR（`/register`）は誰でも呼べるため、「MCP クライアントは事実上1系統」という
 * 前提だけでこの画面を省略すると、攻撃者が任意の redirect_uri でクライアントを
 * 登録し、その認可 URL を利用者に開かせることで、Access ログイン後の MCP 認可
 * コードを攻撃者側へ渡させられる（レビュー指摘）。承認ダイアログで要求元
 * クライアントを利用者に明示し、一度承認したクライアントは Cookie で記憶する。
 *
 * 実装は Cloudflare 公式デモ（cloudflare/ai の demos/remote-mcp-cf-access）の
 * workers-oauth-utils.ts を土台にしている
 */

const CSRF_COOKIE_NAME = "__Host-CSRF_TOKEN";
const APPROVED_CLIENTS_COOKIE_NAME = "__Host-APPROVED_CLIENTS";
const APPROVED_CLIENTS_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30日

export interface CSRFProtectionResult {
  token: string;
  setCookie: string;
}

export function generateCSRFProtection(): CSRFProtectionResult {
  const token = crypto.randomUUID();
  const setCookie = `${CSRF_COOKIE_NAME}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=600`;
  return { token, setCookie };
}

export interface ValidateCSRFResult {
  /** 一回限り使用のトークンを無効化するための Set-Cookie 値 */
  clearCookie: string;
}

export function validateCSRFToken(
  formData: FormData,
  request: Request,
): ValidateCSRFResult {
  const tokenFromForm = formData.get("csrf_token");
  if (!tokenFromForm || typeof tokenFromForm !== "string") {
    throw new Error("CSRF トークンがフォームにありません");
  }

  const cookieHeader = request.headers.get("Cookie") ?? "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const csrfCookie = cookies.find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`));
  const tokenFromCookie = csrfCookie
    ? csrfCookie.substring(CSRF_COOKIE_NAME.length + 1)
    : null;

  if (!tokenFromCookie || tokenFromForm !== tokenFromCookie) {
    throw new Error("CSRF トークンが一致しません");
  }

  const clearCookie = `${CSRF_COOKIE_NAME}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
  return { clearCookie };
}

export async function isClientApproved(
  request: Request,
  clientId: string,
  secret: string,
): Promise<boolean> {
  const approved = await getApprovedClientsFromCookie(request, secret);
  return approved?.includes(clientId) ?? false;
}

export async function addApprovedClient(
  request: Request,
  clientId: string,
  secret: string,
): Promise<string> {
  const existing = (await getApprovedClientsFromCookie(request, secret)) ?? [];
  const updated = Array.from(new Set([...existing, clientId]));

  const payload = JSON.stringify(updated);
  const signature = await signData(payload, secret);
  const cookieValue = `${signature}.${btoa(payload)}`;

  return `${APPROVED_CLIENTS_COOKIE_NAME}=${cookieValue}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${APPROVED_CLIENTS_MAX_AGE_SECONDS}`;
}

async function getApprovedClientsFromCookie(
  request: Request,
  secret: string,
): Promise<string[] | null> {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const target = cookies.find((c) =>
    c.startsWith(`${APPROVED_CLIENTS_COOKIE_NAME}=`),
  );
  if (!target) return null;

  const cookieValue = target.substring(APPROVED_CLIENTS_COOKIE_NAME.length + 1);
  const dotIndex = cookieValue.indexOf(".");
  if (dotIndex === -1) return null;
  const signature = cookieValue.substring(0, dotIndex);
  const base64Payload = cookieValue.substring(dotIndex + 1);
  const payload = atob(base64Payload);

  const isValid = await verifySignature(signature, payload, secret);
  if (!isValid) return null;

  try {
    const parsed = JSON.parse(payload);
    if (
      !Array.isArray(parsed) ||
      !parsed.every((item) => typeof item === "string")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** https/http のみを許可し、javascript: 等の危険なスキームを拒否する */
function sanitizeUrl(url: string): string {
  const normalized = url.trim();
  if (normalized.length === 0) return "";
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return "";
    }
    return normalized;
  } catch {
    return "";
  }
}

export interface ApprovalDialogOptions {
  client: ClientInfo | null;
  csrfToken: string;
  setCookie: string;
  /** フォームに埋め込む state（承認後、そのまま POST /authorize に返ってくる） */
  state: Record<string, unknown>;
}

export function renderApprovalDialog(
  request: Request,
  options: ApprovalDialogOptions,
): Response {
  const { client, csrfToken, setCookie, state } = options;
  const encodedState = btoa(JSON.stringify(state));

  const clientName = client?.clientName
    ? sanitizeText(client.clientName)
    : "不明な MCP クライアント";
  const clientUri = client?.clientUri ? sanitizeUrl(client.clientUri) : "";
  const redirectUris = (client?.redirectUris ?? [])
    .map((uri) => sanitizeUrl(uri))
    .filter((uri) => uri !== "");

  const html = `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${clientName} からの接続リクエスト</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f9fafb; margin: 0; }
      .card { max-width: 480px; margin: 3rem auto; padding: 2rem; background: #fff; border-radius: 8px; box-shadow: 0 8px 36px 8px rgba(0,0,0,0.1); }
      .detail { margin: 0.5rem 0; word-break: break-all; }
      .label { font-weight: 600; }
      .actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
      .button { padding: 0.6rem 1.2rem; border-radius: 6px; font-weight: 500; cursor: pointer; border: none; }
      .primary { background: #0070f3; color: #fff; }
      .secondary { background: transparent; border: 1px solid #e5e7eb; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>CANSHI MCP サーバー</h1>
      <p><strong>${clientName}</strong> が、あなたの CANSHI データへのアクセスを要求しています。</p>
      <div class="detail"><span class="label">クライアント名:</span> ${clientName}</div>
      ${clientUri ? `<div class="detail"><span class="label">Webサイト:</span> <a href="${clientUri}" target="_blank" rel="noopener noreferrer">${clientUri}</a></div>` : ""}
      ${
        redirectUris.length > 0
          ? `<div class="detail"><span class="label">リダイレクト先:</span> ${redirectUris.map((uri) => sanitizeText(uri)).join(", ")}</div>`
          : ""
      }
      <p>許可すると、Cloudflare Access のログインに進みます。</p>
      <form method="post" action="${sanitizeText(new URL(request.url).pathname)}">
        <input type="hidden" name="state" value="${encodedState}" />
        <input type="hidden" name="csrf_token" value="${csrfToken}" />
        <div class="actions">
          <button type="button" class="button secondary" onclick="window.history.back()">キャンセル</button>
          <button type="submit" class="button primary">許可する</button>
        </div>
      </form>
    </div>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "frame-ancestors 'none'",
      "X-Frame-Options": "DENY",
      "Set-Cookie": setCookie,
    },
  });
}
