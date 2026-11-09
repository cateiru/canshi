import { describe, expect, it } from "vitest";
import { detectMcpClientApp } from "./clientApp";

describe("detectMcpClientApp", () => {
  it.each([
    ["https://chatgpt.com/connector_platform_oauth_redirect", "openai"],
    ["https://claude.ai/oauth/mcp-oauth-client-metadata", "claude"],
    ["https://agent.meta.ai/oauth/callback", "meta"],
    ["https://gemini.google.com/callback", "gemini"],
    ["https://www.perplexity.ai/rest/connections/callback", "perplexity"],
  ])("%s のアプリを返す", (uri, app) => {
    expect(detectMcpClientApp(uri)).toBe(app);
  });

  it.each([
    ["無い", null],
    ["URL でない", "chatgpt.com"],
    ["http", "http://chatgpt.com/callback"],
    ["わからないドメイン", "https://example.com/callback"],
    ["ドメインの末尾だけが一致する", "https://notchatgpt.com/callback"],
  ])("%s ときは null を返す", (_, uri) => {
    expect(detectMcpClientApp(uri)).toBeNull();
  });
});
