import { D1KvStore, revokedGrantMarkerKey } from "./d1KvStore";

/** 解除した grant の目印を残す秒数 */
const REVOKED_GRANT_MARKER_TTL_SECONDS = 24 * 60 * 60;

/**
 * 設定の「AIとの接続」に表示する、ユーザーが同意画面で許可した接続（OAuth の grant）
 */
export interface McpConnection {
  /** grant の ID。解除するときに指定する */
  id: string;
  /** クライアントが登録時に名乗った名前。自己申告のため、表示するときはそう書き添える */
  clientName: string | null;
  /** 同意したときの認可コードの渡し先。grant に記録されていない場合は null */
  redirectUri: string | null;
  /** 同意した日時 */
  createdAt: Date;
}

/**
 * 同意画面で許可した接続の一覧を、新しい順に返す。
 *
 * OAuth のデータは `@cloudflare/workers-oauth-provider` が `oauth_kv_entries` に保存している。
 * ライブラリは `cloudflare:workers` に依存し Next.js のバンドルに含められず、
 * `OAuthHelpers.listUserGrants()` を使えないため、同じキー（0.10.4 時点で
 * `grant:{userId}:{grantId}`・`client:{clientId}`）を直接読む。
 * ライブラリを更新したときは、キーの形式が変わっていないか確かめること
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

  return grants
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((grant) => ({
      id: grant.id,
      clientName: clientNames.get(grant.clientId) ?? null,
      redirectUri: grant.redirectUri ?? null,
      createdAt: new Date(grant.createdAt * 1000),
    }));
}

/**
 * 接続を 1 つ解除する。解除済みの目印を置いてから、ライブラリの `OAuthHelpers.revokeGrant()` と同じく、発行済みの
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
  if (!/^[A-Za-z0-9_-]+$/.test(grantId)) {
    return false;
  }
  const store = new D1KvStore(d1);
  const grantKey = `${grantKeyPrefix(userId)}${grantId}`;
  if ((await store.get(grantKey)) === null) {
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
  return true;
}

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
}

function parseStoredGrant(value: unknown): StoredGrant | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { id, clientId, createdAt, expiresAt, redirectUri } = value as Record<
    string,
    unknown
  >;
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
  };
}

function isExpired(grant: StoredGrant) {
  return grant.expiresAt !== undefined && grant.expiresAt * 1000 <= Date.now();
}

/** 登録済みのクライアントの情報から名前だけを取り出す（ほかの項目は画面に渡さない） */
function parseClientName(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { clientName } = value as Record<string, unknown>;
  return typeof clientName === "string" && clientName.trim() !== ""
    ? clientName
    : null;
}
