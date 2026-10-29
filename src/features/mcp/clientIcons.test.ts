import {
  RiClaudeFill,
  RiGeminiFill,
  RiMetaFill,
  RiOpenaiFill,
  RiPerplexityFill,
} from "react-icons/ri";
import { TbPlugConnected } from "react-icons/tb";
import { describe, expect, it } from "vitest";
import { getMcpClientIcon } from "./clientIcons";

describe("getMcpClientIcon", () => {
  it.each([
    ["https://chatgpt.com/connector_platform_oauth_redirect", RiOpenaiFill],
    ["https://chat.openai.com/aip/callback", RiOpenaiFill],
    ["https://claude.ai/api/mcp/auth_callback", RiClaudeFill],
    ["https://claude.com/api/mcp/auth_callback", RiClaudeFill],
    ["https://agent.meta.ai/oauth/callback", RiMetaFill],
    ["https://gemini.google.com/callback", RiGeminiFill],
    ["https://www.perplexity.ai/rest/connections/callback", RiPerplexityFill],
  ])("接続先 %s のアプリのアイコンを返す", (redirectUri, icon) => {
    expect(getMcpClientIcon(redirectUri)).toBe(icon);
  });

  it.each([
    ["わからないドメイン", "https://example.com/callback"],
    ["ドメインの末尾だけが一致する", "https://notchatgpt.com/callback"],
    ["サブドメインに含むだけ", "https://chatgpt.com.example.com/callback"],
    ["http", "http://chatgpt.com/callback"],
    ["アプリのスキーム", "cursor://anysphere.cursor-mcp/oauth/callback"],
    ["URL でない", "not a url"],
  ])("%s なら共通のアイコンを返す", (_, redirectUri) => {
    expect(getMcpClientIcon(redirectUri)).toBe(TbPlugConnected);
  });

  it("接続先が無ければ共通のアイコンを返す", () => {
    expect(getMcpClientIcon(null)).toBe(TbPlugConnected);
  });
});
