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

/** アプリごとのアイコン */
export const MCP_CLIENT_APP_ICON: Readonly<Record<McpClientApp, IconType>> = {
  openai: RiOpenaiFill,
  claude: RiClaudeFill,
  meta: RiMetaFill,
  gemini: RiGeminiFill,
  perplexity: RiPerplexityFill,
};

/**
 * 接続しているアプリのアイコンを、認可コードの渡し先から決める（`detectMcpClientApp`）。
 * わからないアプリ・アプリのスキームは共通のアイコンにする
 */
export function getMcpClientIcon(redirectUri: string | null): IconType {
  const app = detectMcpClientApp(redirectUri);
  return app ? MCP_CLIENT_APP_ICON[app] : TbPlugConnected;
}
