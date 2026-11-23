import type { IconType } from "react-icons";
import {
  RiClaudeFill,
  RiGeminiFill,
  RiMetaFill,
  RiOpenaiFill,
  RiPerplexityFill,
} from "react-icons/ri";
import { TbPlugConnected } from "react-icons/tb";
import { detectMcpClientApp, type McpClientApp } from "../domain/clientApp";

/**
 * アプリごとのアイコン。管理画面（`packages/admin`）の「AIとの接続」でも使うため、
 * `react-icons` と相対パスだけを import する（Next.js のパスエイリアス `@/` などを使わない）
 */
export const MCP_CLIENT_APP_ICON: Readonly<Record<McpClientApp, IconType>> = {
  openai: RiOpenaiFill,
  claude: RiClaudeFill,
  meta: RiMetaFill,
  gemini: RiGeminiFill,
  perplexity: RiPerplexityFill,
};

/** アイコンを見分けられないアプリ（わからないアプリ・アプリのスキーム）の共通のアイコン */
export const UNKNOWN_MCP_CLIENT_ICON: IconType = TbPlugConnected;

/**
 * 接続しているアプリのアイコンを、認可コードの渡し先から決める（`detectMcpClientApp`）。
 * わからないアプリ・アプリのスキームは共通のアイコンにする
 */
export function getMcpClientIcon(redirectUri: string | null): IconType {
  const app = detectMcpClientApp(redirectUri);
  return app ? MCP_CLIENT_APP_ICON[app] : UNKNOWN_MCP_CLIENT_ICON;
}
