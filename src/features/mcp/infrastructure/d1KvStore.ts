import { and, asc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { oauthKvEntries } from "@/db/schema";

/** `list()` で `limit` を省略したときの件数（Workers KV と同じ） */
const DEFAULT_LIST_LIMIT = 1000;

/**
 * MCP の OAuth 認可サーバー（`@cloudflare/workers-oauth-provider`）に `env.OAUTH_KV` として
 * 渡す、D1（`oauth_kv_entries`）に保存する KV。ライブラリは保存先を差し替える
 * オプションを持たず Workers KV の API を直接呼ぶため、ライブラリが使う操作
 * （`get`・`put` の `expirationTtl`/`expiration`・`delete`・`list` の
 * `prefix`/`limit`/`cursor`）だけを同じ形で実装する。ライブラリを更新したときは、
 * ほかの操作を使い始めていないか確かめること。
 *
 * 期限切れの行は読み出し時に無いものとして扱い、定期実行（`purgeExpiredOAuthKvEntries`）で消す
 */
export class D1KvStore {
  /** `d1` を省略すると `getDb()` と同じくリクエストスコープの D1 を使う */
  constructor(private readonly d1?: D1Database) {}

  async get(
    key: string,
    options?: { type?: "text" | "json" } | "text" | "json",
  ) {
    const [row] = await getDb(this.d1)
      .select({ value: oauthKvEntries.value })
      .from(oauthKvEntries)
      .where(and(eq(oauthKvEntries.key, key), notExpired()))
      .limit(1);
    if (!row) {
      return null;
    }
    const type = typeof options === "string" ? options : options?.type;
    return type === "json" ? JSON.parse(row.value) : row.value;
  }

  /**
   * `grant:{userId}:{grantId}`・`token:{userId}:{grantId}:{tokenId}` は、その grant が
   * 解除済み（`revokedGrantMarkerKey` の目印がある）なら書き込まずに戻る（`connections.ts` の
   * `revokeUserMcpConnection` 参照）。ライブラリのトークンの更新は grant を読んでから
   * grant とトークンを書き戻すため、解除と重なると解除した grant が復活してしまう。
   * 目印の確認と書き込みを 1 つの文で行い、解除の後に書き戻されないようにする。
   * 書き込まなかった場合も例外にはせず、解除済みの grant が消えたときと同じく、
   * 発行されたトークンが使えないだけにする
   */
  async put(
    key: string,
    value: string,
    options: { expirationTtl?: number; expiration?: number } = {},
  ) {
    const expiresAt = toExpiresAt(options);
    const grant = parseGrantOfKey(key);
    if (grant) {
      const marker = revokedGrantMarkerKey(grant.userId, grant.grantId);
      const expiresAtSeconds =
        expiresAt === null ? null : Math.floor(expiresAt.getTime() / 1000);
      // `INSERT ... SELECT` に `ON CONFLICT` を付けるときは、構文の曖昧さを避けるため
      // SELECT に WHERE が必要（`NOT EXISTS` がそれを兼ねる）
      await getDb(this.d1).run(sql`
        INSERT INTO oauth_kv_entries ("key", "value", "expires_at")
        SELECT ${key}, ${value}, ${expiresAtSeconds}
        WHERE NOT EXISTS (
          SELECT 1 FROM oauth_kv_entries WHERE "key" = ${marker}
        )
        ON CONFLICT ("key") DO UPDATE SET
          "value" = excluded."value",
          "expires_at" = excluded."expires_at"
      `);
      return;
    }
    await getDb(this.d1)
      .insert(oauthKvEntries)
      .values({ key, value, expiresAt })
      .onConflictDoUpdate({
        target: oauthKvEntries.key,
        set: { value, expiresAt },
      });
  }

  async delete(key: string) {
    await getDb(this.d1)
      .delete(oauthKvEntries)
      .where(eq(oauthKvEntries.key, key));
  }

  /**
   * キーの昇順に返す。`cursor` は前のページの最後のキーで、Workers KV と同じく
   * 続きがあるときだけ返す
   */
  async list(
    options: { prefix?: string; limit?: number; cursor?: string } = {},
  ) {
    const prefix = options.prefix ?? "";
    const limit = options.limit ?? DEFAULT_LIST_LIMIT;
    const rows = await getDb(this.d1)
      .select({ key: oauthKvEntries.key })
      .from(oauthKvEntries)
      .where(
        and(
          sql`substr(${oauthKvEntries.key}, 1, ${prefix.length}) = ${prefix}`,
          options.cursor ? gt(oauthKvEntries.key, options.cursor) : undefined,
          notExpired(),
        ),
      )
      .orderBy(asc(oauthKvEntries.key))
      .limit(limit + 1);
    const keys = rows.slice(0, limit).map((row) => ({ name: row.key }));
    const listComplete = rows.length <= limit;
    return listComplete
      ? { keys, list_complete: true as const, cacheStatus: null }
      : {
          keys,
          list_complete: false as const,
          cursor: keys[keys.length - 1].name,
          cacheStatus: null,
        };
  }
}

/**
 * 解除した grant の目印のキー。ライブラリが `grant:{userId}:` で列挙しても混ざらないよう、
 * `grant:` 以外で始める
 */
export function revokedGrantMarkerKey(userId: string, grantId: string) {
  return `revoked-grant:${userId}:${grantId}`;
}

/**
 * ライブラリ（1.2.4）の grant・アクセストークンのキーから、ユーザー ID と grant ID を
 * 取り出す。それ以外のキーは null
 */
function parseGrantOfKey(key: string) {
  const match = /^(?:grant:([^:]+):([^:]+)|token:([^:]+):([^:]+):[^:]+)$/.exec(
    key,
  );
  if (!match) {
    return null;
  }
  return {
    userId: match[1] ?? match[3],
    grantId: match[2] ?? match[4],
  };
}

function notExpired() {
  return or(
    isNull(oauthKvEntries.expiresAt),
    gt(oauthKvEntries.expiresAt, new Date()),
  );
}

/** Workers KV の `expirationTtl`（今からの秒数）・`expiration`（unix 秒）を期限の日時にする */
function toExpiresAt(options: { expirationTtl?: number; expiration?: number }) {
  if (options.expirationTtl !== undefined) {
    return new Date(Date.now() + options.expirationTtl * 1000);
  }
  if (options.expiration !== undefined) {
    return new Date(options.expiration * 1000);
  }
  return null;
}

/** 期限切れの行を削除する（`src/worker.ts` の定期実行から呼ぶ） */
export async function purgeExpiredOAuthKvEntries(d1: D1Database) {
  await getDb(d1)
    .delete(oauthKvEntries)
    .where(lte(oauthKvEntries.expiresAt, new Date()));
}
