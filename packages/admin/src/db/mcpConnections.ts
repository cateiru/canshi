/**
 * 管理画面の「AIとの接続」に表示する、AI のアプリ（MCP クライアント）のプロバイダーごとの接続の件数。
 *
 * OAuth のデータは、メインアプリの MCP の認可サーバー（`@cloudflare/workers-oauth-provider`）が
 * `oauth_kv_entries` に保存している。メインアプリの設定の「AIとの接続」
 * （`src/features/mcp/infrastructure/connections.ts`）と同じく、ライブラリのキー
 * （`grant:{userId}:{grantId}`・`client:{clientId}`）を直接読む（あちらは Next.js のパスエイリアスに
 * 依存するため import できない）。読み出すだけで書き込まない。grant・クライアントの情報のうち、
 * 画面にはプロバイダーごとの件数と、アプリが名乗った名前だけを返す
 */

import { and, gt, inArray, isNull, like, or } from "drizzle-orm";
import {
  detectMcpClientApp,
  MCP_CLIENT_APPS,
  type McpClientApp,
} from "../../../../src/features/mcp/domain/clientApp";
import type { McpProvider } from "../models";
import type { AdminDb } from "./client";
import { oauthKvEntries } from "./schema";

/**
 * クライアントの登録を分けて読む件数。D1 の 1 つの文に渡せるバインドパラメーターの数（100）に
 * 収める
 */
const CLIENT_QUERY_CHUNK_SIZE = 90;

/**
 * プロバイダーごとの有効な接続の件数。アイコンを見分けられるアプリ（`MCP_CLIENT_APPS`）を
 * 接続が無くてもその順に並べ、続けて見分けられないプロバイダーを接続の多い順に並べる。
 *
 * プロバイダーは、メインアプリの設定の「AIとの接続」のアイコンと同じく、grant に記録された
 * 認可コードの渡し先から決める（`detectMcpClientApp`）。見分けられない接続は、アプリを足すときに
 * 登録するドメインがわかるよう、渡し先のホストごとにまとめる
 */
export async function listMcpProviders(
  db: AdminDb,
  now: Date = new Date(),
): Promise<McpProvider[]> {
  const rows = await db
    .select({ value: oauthKvEntries.value })
    .from(oauthKvEntries)
    .where(and(like(oauthKvEntries.key, "grant:%"), notExpired(now)));
  const grants = rows
    .map((row) => parseGrant(row.value))
    .filter(
      (grant): grant is StoredGrant =>
        grant !== null && !isGrantExpired(grant, now),
    );
  const clientNames = await readClientNames(
    db,
    [...new Set(grants.map((grant) => grant.clientId))],
    now,
  );

  const known = new Map<McpClientApp, McpProvider>(
    MCP_CLIENT_APPS.map((app) => [app, emptyProvider(app, null)]),
  );
  const unknown = new Map<string | null, McpProvider>();
  for (const grant of grants) {
    const app = detectMcpClientApp(grant.redirectUri);
    let provider = app ? known.get(app) : undefined;
    if (!provider) {
      const redirectHost = formatRedirectHost(grant.redirectUri);
      provider = unknown.get(redirectHost) ?? emptyProvider(null, redirectHost);
      unknown.set(redirectHost, provider);
    }
    provider.connectionCount += 1;
    const clientName = clientNames.get(grant.clientId) ?? grant.clientName;
    if (clientName && !provider.clientNames.includes(clientName)) {
      provider.clientNames.push(clientName);
    }
  }

  const providers = [
    ...known.values(),
    ...[...unknown.values()].sort(compareUnknownProviders),
  ];
  for (const provider of providers) {
    provider.clientNames.sort(compareText);
  }
  return providers;
}

function emptyProvider(
  app: McpClientApp | null,
  redirectHost: string | null,
): McpProvider {
  return { app, redirectHost, connectionCount: 0, clientNames: [] };
}

/** 見分けられないプロバイダーの並び（接続の多い順、接続先の名前順。接続先の記録が無いものは最後） */
function compareUnknownProviders(a: McpProvider, b: McpProvider) {
  if (a.connectionCount !== b.connectionCount) {
    return b.connectionCount - a.connectionCount;
  }
  if (a.redirectHost === null) {
    return b.redirectHost === null ? 0 : 1;
  }
  if (b.redirectHost === null) {
    return -1;
  }
  return compareText(a.redirectHost, b.redirectHost);
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "ja");
}

/**
 * 認可コードの渡し先を、プロバイダーを見分けるための接続先にする。https ならホスト
 * （`chatgpt.com` など。アプリを足すときに `CLIENT_APP_DOMAINS` に登録する形）、それ以外は
 * スキームを付けたホスト（`http://localhost:6274`・`cursor://anysphere.cursor-mcp` など）にする。
 * URL でなければそのまま、記録が無ければ null
 */
export function formatRedirectHost(
  redirectUri: string | undefined,
): string | null {
  if (!redirectUri) {
    return null;
  }
  try {
    const url = new URL(redirectUri);
    if (url.protocol === "https:") {
      return url.host;
    }
    return url.host ? `${url.protocol}//${url.host}` : url.protocol;
  } catch {
    return redirectUri;
  }
}

/** 接続したクライアントの登録（`client:{clientId}`）から、名乗った名前を読む */
async function readClientNames(db: AdminDb, clientIds: string[], now: Date) {
  const chunks: string[][] = [];
  for (let i = 0; i < clientIds.length; i += CLIENT_QUERY_CHUNK_SIZE) {
    chunks.push(clientIds.slice(i, i + CLIENT_QUERY_CHUNK_SIZE));
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      db
        .select({ value: oauthKvEntries.value })
        .from(oauthKvEntries)
        .where(
          and(
            inArray(
              oauthKvEntries.key,
              chunk.map((clientId) => `client:${clientId}`),
            ),
            notExpired(now),
          ),
        ),
    ),
  );
  const names = new Map<string, string>();
  for (const row of results.flat()) {
    const client = parseJsonObject(row.value);
    const clientName = parseClientName(client);
    if (client && typeof client.clientId === "string" && clientName) {
      names.set(client.clientId, clientName);
    }
  }
  return names;
}

function notExpired(now: Date) {
  return or(
    isNull(oauthKvEntries.expiresAt),
    gt(oauthKvEntries.expiresAt, now),
  );
}

/** `oauth_kv_entries` に保存された grant のうち、ここで使う項目 */
interface StoredGrant {
  clientId: string;
  /** unix 秒。grant の有効期限を設定していない場合は無い */
  expiresAt?: number;
  redirectUri?: string;
  /** 同意したときに残したクライアントの名前（`metadata.clientName`） */
  clientName?: string;
}

function parseGrant(value: string): StoredGrant | null {
  const grant = parseJsonObject(value);
  if (!grant || typeof grant.clientId !== "string") {
    return null;
  }
  return {
    clientId: grant.clientId,
    expiresAt:
      typeof grant.expiresAt === "number" ? grant.expiresAt : undefined,
    redirectUri:
      typeof grant.redirectUri === "string" ? grant.redirectUri : undefined,
    clientName: parseClientName(asObject(grant.metadata)) ?? undefined,
  };
}

function isGrantExpired(grant: StoredGrant, now: Date) {
  return (
    grant.expiresAt !== undefined && grant.expiresAt * 1000 <= now.getTime()
  );
}

/** 保存された JSON の文字列をオブジェクトとして読む。読めない・オブジェクトでなければ null */
function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    return asObject(JSON.parse(text));
  } catch {
    return null;
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** クライアントの登録・grant の `metadata` から、名乗った名前を取り出す（空なら null） */
function parseClientName(value: Record<string, unknown> | null) {
  const clientName = value?.clientName;
  return typeof clientName === "string" && clientName.trim() !== ""
    ? clientName
    : null;
}
