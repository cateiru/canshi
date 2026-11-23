import type { McpClientApp } from "./clientApp";

/**
 * アイコンを見分けられる AI のアプリ（プロバイダー）の表示名。管理画面の「AIとの接続」
 * （`packages/admin`）で、プロバイダーごとの接続の件数を表示するときに使う
 */
export const MCP_CLIENT_APP_LABEL: Readonly<Record<McpClientApp, string>> = {
  openai: "ChatGPT",
  claude: "Claude",
  meta: "Meta AI",
  gemini: "Gemini",
  perplexity: "Perplexity",
};
