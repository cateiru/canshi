import type { ApiTokenExpiration } from "./apiToken";

export const API_TOKEN_EXPIRATION_LABEL: Record<ApiTokenExpiration, string> = {
  "1d": "1日",
  "7d": "7日",
  "30d": "30日",
  "90d": "90日",
  none: "期限なし",
};
