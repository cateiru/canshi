import { normalizeUserAgent } from "@/features/auth/domain/deviceName";

/** 保存するパスの最大長。存在しないパスへのリクエストも残すため、長すぎる分は切り捨てる */
export const MAX_API_ACCESS_LOG_PATH_LENGTH = 512;

/** アクセス履歴の、保存する中身 */
export interface ApiAccessLogContent {
  method: string;
  path: string;
  status: number;
  ipAddress: string | null;
  userAgent: string | null;
}

/** リクエストと応答から、アクセス履歴の中身を作る。クエリには検索した語などが含まれるため残さない */
export function toApiAccessLogContent(access: {
  method: string;
  path: string;
  status: number;
  ipAddress: string | null;
  userAgent: string | null;
}): ApiAccessLogContent {
  return {
    method: access.method,
    path: access.path.slice(0, MAX_API_ACCESS_LOG_PATH_LENGTH),
    status: access.status,
    ipAddress: access.ipAddress,
    userAgent: normalizeUserAgent(access.userAgent),
  };
}
