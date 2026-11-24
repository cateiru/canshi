import {
  generateSessionToken,
  hashSessionToken,
} from "@/features/auth/domain/sessionToken";
import type { AccessPermissions } from "@/features/external-access/domain/permissionRules";

/** トークンの先頭に付ける文字列。どのサービスのトークンかを見分けられるようにする */
export const API_TOKEN_PREFIX = "canshi_";

/** 発行するときに選ぶ有効期限 */
export const API_TOKEN_EXPIRATIONS = [
  "1d",
  "7d",
  "30d",
  "90d",
  "none",
] as const;

export type ApiTokenExpiration = (typeof API_TOKEN_EXPIRATIONS)[number];

export const DEFAULT_API_TOKEN_EXPIRATION: ApiTokenExpiration = "30d";

const API_TOKEN_EXPIRATION_DAYS: Record<ApiTokenExpiration, number | null> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  none: null,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** 発行した日時と選んだ有効期限から、使えなくなる日時を求める。期限なしなら null */
export function apiTokenExpiresAt(
  expiration: ApiTokenExpiration,
  now: Date,
): Date | null {
  const days = API_TOKEN_EXPIRATION_DAYS[expiration];
  return days === null ? null : new Date(now.getTime() + days * DAY_MS);
}

/** トークンの期限が切れているか */
export function isApiTokenExpired(
  token: { expiresAt: Date | null },
  now: Date,
): boolean {
  return token.expiresAt !== null && token.expiresAt.getTime() <= now.getTime();
}

/** トークン（先頭の文字列と、32 バイトの乱数を base64url にしたもの）を作る */
export function generateApiToken(): string {
  return `${API_TOKEN_PREFIX}${generateSessionToken()}`;
}

/** DB に保存するトークンのハッシュ（SHA-256 の 16 進文字列）。トークンそのものは保存しない */
export function hashApiToken(token: string): Promise<string> {
  return hashSessionToken(token);
}

/** `Authorization: Bearer <トークン>` からトークンを取り出す。トークンの形でなければ null */
export function readBearerToken(authorization: string | null): string | null {
  const match = /^Bearer +(\S+)$/i.exec(authorization?.trim() ?? "");
  return match?.[1].startsWith(API_TOKEN_PREFIX) ? match[1] : null;
}

/** 発行するトークンの、保存する中身 */
export interface ApiTokenContent {
  name: string;
  tokenHash: string;
  /** 使えなくなる日時。期限なしなら null */
  expiresAt: Date | null;
  permissions: AccessPermissions;
}
