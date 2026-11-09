/** アイコンを見分けられる AI のアプリ（MCP クライアント） */
export const MCP_CLIENT_APPS = [
  "openai",
  "claude",
  "meta",
  "gemini",
  "perplexity",
] as const;

export type McpClientApp = (typeof MCP_CLIENT_APPS)[number];

/**
 * アプリごとの、認可コードの渡し先などに使うドメイン。
 * ドメインはそのものか、そのサブドメインに一致させる
 */
const CLIENT_APP_DOMAINS: Readonly<Record<McpClientApp, readonly string[]>> = {
  openai: ["chatgpt.com", "openai.com"],
  claude: ["claude.ai", "claude.com"],
  meta: ["meta.ai"],
  gemini: ["gemini.google.com"],
  perplexity: ["perplexity.ai"],
};

/**
 * 接続しているアプリを、認可コードの渡し先（CIMD のクライアントではクライアントの ID の URL）
 * から決める。アプリの名前は自己申告なので使わない。渡し先のドメインは、そこへ認可コードを
 * 渡す以上、名乗りだけで偽ることはできない。https 以外・わからないドメインなら null
 */
export function detectMcpClientApp(
  uri: string | null | undefined,
): McpClientApp | null {
  if (!uri) {
    return null;
  }
  let hostname: string;
  try {
    const url = new URL(uri);
    if (url.protocol !== "https:") {
      return null;
    }
    hostname = url.hostname;
  } catch {
    return null;
  }
  return (
    MCP_CLIENT_APPS.find((app) =>
      CLIENT_APP_DOMAINS[app].some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      ),
    ) ?? null
  );
}
