import { D1KvStore, revokedGrantMarkerKey } from "./d1KvStore";
import { deleteMcpPermissions } from "./permissions";
import {
  deleteMcpConnectionUsage,
  listMcpConnectionLastUsedAt,
} from "./usages";

/** 解除した grant の目印を残す秒数 */
const REVOKED_GRANT_MARKER_TTL_SECONDS = 24 * 60 * 60;

/**
 * 設定の「AIとの接続」に表示する、ユーザーが同意画面で許可した接続（OAuth の grant）
 */
export interface McpConnection {
  /** grant の ID。解除するとき・読み取りの範囲を設定するときに指定する */
  id: string;
  /**
   * OAuth のクライアントの ID。読み取りの範囲（`./permissions.ts`）はこれで見分ける。
   * 同じクライアントにもう一度同意すると古い grant は解除されるため、ユーザーの接続の
   * 中でクライアントの ID は重ならない。URL などでクライアントに渡さないこと
   */
  clientId: string;
  /** クライアントが登録時に名乗った名前。自己申告のため、表示するときはそう書き添える */
  clientName: string | null;
  /** 同意したときの認可コードの渡し先。grant に記録されていない場合は null */
  redirectUri: string | null;
  /** 同意した日時 */
  createdAt: Date;
  /**
   * AI のアプリがこの接続を最後に使った日時（`./usages.ts`）。記録が無い場合は null。
   * 記録は 1 分ごとのため、それより短い間の利用は反映されない
   */
  lastUsedAt: Date | null;
}

/**
 * 同意画面で許可した接続の一覧を、新しい順に返す。
 *
 * OAuth のデータは `@cloudflare/workers-oauth-provider` が `oauth_kv_entries` に保存している。
 * ライブラリは `cloudflare:workers` に依存し Next.js のバンドルに含められず、
 * `OAuthHelpers.listUserGrants()` を使えないため、同じキー（1.2.4 時点で
 * `grant:{userId}:{grantId}`・`client:{clientId}`）を直接読む。
 * ライブラリを更新したときは、キーの形式が変わっていないか確かめること。
 * CIMD のクライアントは `client:{clientId}` が無いため、同意したときに grant に残した
 * 名前（`./authorize.ts`）を使う
 */
export async function listUserMcpConnections(
  userId: string,
  d1?: D1Database,
): Promise<McpConnection[]> {
  const store = new D1KvStore(d1);
  const grants: StoredGrant[] = [];
  let cursor: string | undefined;
  do {
    const page = await store.list({ prefix: grantKeyPrefix(userId), cursor });
    for (const { name } of page.keys) {
      const grant = parseStoredGrant(await store.get(name, "json"));
      if (grant && !isExpired(grant)) {
        grants.push(grant);
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  const clientNames = new Map<string, string | null>();
  for (const { clientId } of grants) {
    if (!clientNames.has(clientId)) {
      clientNames.set(
        clientId,
        parseClientName(await store.get(`client:${clientId}`, "json")),
      );
    }
  }

  const lastUsedAts = await listMcpConnectionLastUsedAt(userId, d1);

  return grants
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((grant) => ({
      id: grant.id,
      clientId: grant.clientId,
      clientName: clientNames.get(grant.clientId) ?? grant.clientName ?? null,
      redirectUri: grant.redirectUri ?? null,
      createdAt: new Date(grant.createdAt * 1000),
      lastUsedAt: lastUsedAts.get(grant.id) ?? null,
    }));
}

/** ユーザーの接続のうち、指定した grant の ID のもの。無い・別のユーザーの接続なら null */
export async function getUserMcpConnection(
  userId: string,
  grantId: string,
  d1?: D1Database,
): Promise<McpConnection | null> {
  const connections = await listUserMcpConnections(userId, d1);
  return connections.find((connection) => connection.id === grantId) ?? null;
}

/**
 * grant のクライアントの ID。MCP のリクエストで、アクセストークンがどの接続のものかを
 * 求めるのに使う（`./clientId.ts`）。grant が無ければ null
 */
export async function getGrantClientId(
  userId: string,
  grantId: string,
  d1?: D1Database,
): Promise<string | null> {
  // キーの区切り（`:`）を含む ID でほかの grant のキーを指せないよう、
  // ライブラリが発行する形式（英数字と `-`・`_`）以外は受け付けない
  if (!GRANT_ID_PATTERN.test(grantId)) {
    return null;
  }
  const store = new D1KvStore(d1);
  const grant = parseStoredGrant(
    await store.get(`${grantKeyPrefix(userId)}${grantId}`, "json"),
  );
  return grant?.clientId ?? null;
}

/**
 * 接続を 1 つ解除し、その接続の読み取りの範囲と、最後に使った日時の記録も消す。解除済みの目印を置いてから、ライブラリの `OAuthHelpers.revokeGrant()` と同じく、発行済みの
 * アクセストークン（`token:{userId}:{grantId}:{tokenId}`）を消してから grant を消す。
 * リフレッシュトークンは grant の中に保存されているため、grant を消すと使えなくなる。
 * 別のユーザーの接続は解除できない。解除したかどうかを返す
 */
export async function revokeUserMcpConnection(
  userId: string,
  grantId: string,
  d1?: D1Database,
): Promise<boolean> {
  // キーの区切り（`:`）を含む ID でほかの grant のキーを指せないよう、
  // ライブラリが発行する形式（英数字と `-`・`_`）以外は受け付けない
  if (!GRANT_ID_PATTERN.test(grantId)) {
    return false;
  }
  const store = new D1KvStore(d1);
  const grantKey = `${grantKeyPrefix(userId)}${grantId}`;
  const grant = await store.get(grantKey, "json");
  if (grant === null) {
    return false;
  }

  // 先に解除済みの目印を置き、この後に grant・トークンが書き込まれないようにする
  // （`D1KvStore.put` 参照）。目印より前に書き込まれたものは、続けて削除する。
  // トークンの更新は数秒で終わるため、目印は 1 日で消えてよい（定期実行で削除される）
  await store.put(revokedGrantMarkerKey(userId, grantId), "1", {
    expirationTtl: REVOKED_GRANT_MARKER_TTL_SECONDS,
  });

  let cursor: string | undefined;
  do {
    const page = await store.list({
      prefix: `token:${userId}:${grantId}:`,
      cursor,
    });
    for (const { name } of page.keys) {
      await store.delete(name);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  await store.delete(grantKey);
  // 使った日時の記録は grant を消した後に消す。解除の前に始まったリクエストの記録は、
  // grant が無いと書き込まれない（`./usages.ts` の `recordMcpConnectionUsage`）
  await deleteMcpConnectionUsage(userId, grantId, d1);

  // 読み取りの範囲も消す。もう一度接続したときは、すべて読み取れる状態から選び直す。
  // CIMD のクライアントは同じアプリのすべての接続で ID が同じため、同じユーザーが同じアプリと
  // ほかにも接続している（戻り先の違う grant が残っている）ときは、範囲をその接続と共有して
  // いるため消さない。消すと、残った接続の範囲がすべて読み取れる状態に戻ってしまう
  const clientId = parseStoredGrant(grant)?.clientId;
  if (clientId) {
    const remaining = await listUserMcpConnections(userId, d1);
    if (!remaining.some((connection) => connection.clientId === clientId)) {
      await deleteMcpPermissions(userId, clientId, d1);
    }
  }
  return true;
}

/** ライブラリが発行する grant の ID の形式 */
const GRANT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function grantKeyPrefix(userId: string) {
  return `grant:${userId}:`;
}

/** `oauth_kv_entries` に保存された grant のうち、ここで使う項目 */
interface StoredGrant {
  id: string;
  clientId: string;
  /** unix 秒 */
  createdAt: number;
  /** unix 秒。grant の有効期限を設定していない場合は無い */
  expiresAt?: number;
  redirectUri?: string;
  /** 同意したときに残したクライアントの名前（`metadata.clientName`、`./authorize.ts`） */
  clientName?: string;
}

function parseStoredGrant(value: unknown): StoredGrant | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { id, clientId, createdAt, expiresAt, redirectUri, metadata } =
    value as Record<string, unknown>;
  if (
    typeof id !== "string" ||
    typeof clientId !== "string" ||
    typeof createdAt !== "number"
  ) {
    return null;
  }
  return {
    id,
    clientId,
    createdAt,
    expiresAt: typeof expiresAt === "number" ? expiresAt : undefined,
    redirectUri: typeof redirectUri === "string" ? redirectUri : undefined,
    clientName: parseClientName(metadata) ?? undefined,
  };
}

function isExpired(grant: StoredGrant) {
  return grant.expiresAt !== undefined && grant.expiresAt * 1000 <= Date.now();
}

/**
 * 登録済みのクライアントの情報・grant の `metadata` から名前だけを取り出す
 * （ほかの項目は画面に渡さない）
 */
function parseClientName(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { clientName } = value as Record<string, unknown>;
  return typeof clientName === "string" && clientName.trim() !== ""
    ? clientName
    : null;
}
