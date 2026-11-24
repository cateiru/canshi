import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { apiAccessLogs, apiTokens, users } from "@/db/schema";
import type { AccessPermissions } from "@/features/external-access/domain/permissionRules";
import { toAccessPermissions } from "@/features/external-access/infrastructure/permissions";
import { hashApiToken } from "../domain/apiToken";

/** 設定の「APIトークン」に表示するトークン。トークンのハッシュは画面に渡さない */
export interface ApiTokenSummary {
  id: string;
  name: string;
  /** 使えなくなる日時。期限なしなら null */
  expiresAt: Date | null;
  createdAt: Date;
  /** 最後に使った日時（アクセス履歴の最も新しい日時）。まだ使っていなければ null */
  lastUsedAt: Date | null;
}

// 最も新しい履歴は、トークンごとのインデックスの末尾だけを読んで求める（履歴をすべて読まない）。
// 1 つのテーブルだけの select では drizzle が列の表名を省くため、列は表の別名を付けて書く
const summaryColumns = {
  id: apiTokens.id,
  name: apiTokens.name,
  expiresAt: apiTokens.expiresAt,
  createdAt: apiTokens.createdAt,
  lastUsedAt: sql<number | null>`(
    SELECT max(l.created_at) FROM ${apiAccessLogs} AS l
    WHERE l.api_token_id = ${apiTokens}.id
  )`,
};

function toLastUsedAt(seconds: number | null): Date | null {
  return seconds === null ? null : new Date(seconds * 1000);
}

/** ユーザーが発行したトークンの一覧（期限が切れたものを含む）を、新しい順に返す */
export async function listApiTokensForUser(
  userId: string,
  d1?: D1Database,
): Promise<ApiTokenSummary[]> {
  const rows = await getDb(d1)
    .select(summaryColumns)
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    // created_at は秒単位のため、同じ秒に発行したものは rowid（挿入順）で新しい順に並べる
    .orderBy(desc(apiTokens.createdAt), desc(sql`${apiTokens}.rowid`));
  return rows.map((row) => ({
    ...row,
    lastUsedAt: toLastUsedAt(row.lastUsedAt),
  }));
}

/** ユーザーが発行したトークンと、許可した範囲。無い・別のユーザーのトークンなら null */
export async function getApiTokenForUser(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<(ApiTokenSummary & { permissions: AccessPermissions }) | null> {
  const [row] = await getDb(d1)
    .select({ summary: summaryColumns, token: apiTokens })
    .from(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    ...row.summary,
    lastUsedAt: toLastUsedAt(row.summary.lastUsedAt),
    permissions: toAccessPermissions(row.token),
  };
}

/** API のリクエストに付けられたトークンの、ユーザーと許可した範囲 */
export interface ApiTokenAccess {
  id: string;
  userId: string;
  expiresAt: Date | null;
  permissions: AccessPermissions;
}

/**
 * トークンに対応するトークンの行と範囲を返す。無い（削除された）・ユーザーが削除されていれば null。
 * 期限は確かめないため、呼び出し元で `isApiTokenExpired` で確かめること
 */
export async function findApiTokenAccess(
  token: string,
  d1?: D1Database,
): Promise<ApiTokenAccess | null> {
  const [row] = await getDb(d1)
    .select({ token: apiTokens })
    .from(apiTokens)
    .innerJoin(users, eq(apiTokens.userId, users.id))
    .where(eq(apiTokens.tokenHash, await hashApiToken(token)))
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    id: row.token.id,
    userId: row.token.userId,
    expiresAt: row.token.expiresAt,
    permissions: toAccessPermissions(row.token),
  };
}
