import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { McpProvidersResponse } from "../../api/types";
import { renderApp, stubApi } from "../test/render";

function known(
  app: NonNullable<McpProvidersResponse["providers"][number]["app"]>,
  connectionCount: number,
) {
  return { app, redirectHost: null, connectionCount, clientNames: [] };
}

const KNOWN_ONLY: McpProvidersResponse = {
  providers: [
    known("openai", 3),
    known("claude", 1),
    known("meta", 0),
    known("gemini", 0),
    known("perplexity", 0),
  ],
};

const WITH_UNKNOWN: McpProvidersResponse = {
  providers: [
    ...KNOWN_ONLY.providers,
    {
      app: null,
      redirectHost: "agent.example.com",
      connectionCount: 2,
      clientNames: ["Agent A", "Agent B"],
    },
    { app: null, redirectHost: null, connectionCount: 1, clientNames: [] },
  ],
};

/** 表の行ごとの、プロバイダー（行の見出し）と接続件数 */
function rows() {
  return screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => [
      within(row).getByRole("rowheader").textContent,
      within(row).getAllByRole("cell").at(-1)?.textContent,
    ]);
}

describe("AIとの接続", () => {
  it("プロバイダーごとの接続件数を、アイコンを設定していないものも含めて表示する", async () => {
    stubApi({ "GET /ai-connections": WITH_UNKNOWN });
    await renderApp("/ai-connections");
    expect(
      screen.getByRole("heading", { level: 2, name: "AIとの接続" }),
    ).toBeInTheDocument();
    expect(rows()).toEqual([
      ["ChatGPT", "3"],
      ["Claude", "1"],
      ["Meta AI", "0"],
      ["Gemini", "0"],
      ["Perplexity", "0"],
      ["agent.example.comアイコン未設定名乗った名前：Agent A、Agent B", "2"],
      ["接続先の記録なしアイコン未設定", "1"],
    ]);
    expect(screen.getByRole("status")).toHaveTextContent(
      "アイコンを設定していないプロバイダーとの接続があります。",
    );
  });

  it("アイコンを設定していないプロバイダーとの接続がなければ、追加を促さない", async () => {
    stubApi({ "GET /ai-connections": KNOWN_ONLY });
    await renderApp("/ai-connections");
    expect(rows()).toHaveLength(5);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("アイコン未設定")).toBeNull();
  });

  it("ナビゲーションから開ける", async () => {
    stubApi({ "GET /ai-connections": KNOWN_ONLY });
    await renderApp("/ai-connections");
    expect(screen.getByRole("link", { name: "AIとの接続" })).toHaveAttribute(
      "href",
      "/ai-connections",
    );
  });
});
