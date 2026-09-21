import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

/**
 * `/callback`（`src/auth/handler.ts`）が `completeAuthorization()` の `props` に
 * 渡す値と対応する。Durable Object 上で永続化され、`this.props` として
 * ツール実装から参照できる
 */
export interface McpProps extends Record<string, unknown> {
  email: string;
  sub: string;
}

/**
 * CANSHI の MCP サーバー本体。読み取り専用ツール（猫のプロフィール参照・
 * タイムライン参照）を、Service Bindings 経由でメインアプリ（canshi）の
 * `McpRpc`（src/worker.ts）を呼び出すことで実装する。
 *
 * 書き込み系ツールは対象外（docs/plans/32_mcp_oidc_overview.md 参照）。
 * `this.props.email` は今回は認可判定に使わない（単一世帯利用のため、
 * Cloudflare Access を通過したユーザーは全員同じ権限を持つ想定）が、
 * 将来の監査ログ用に残しておく
 */
export class CanshiMcp extends McpAgent<Env, Record<string, never>, McpProps> {
  server = new McpServer({ name: "CANSHI MCP Server", version: "0.1.0" });

  async init() {
    this.server.registerTool(
      "list_cats",
      {
        title: "猫の一覧を取得",
        description: "登録されている猫のプロフィール一覧を取得する。",
      },
      async () => {
        const cats = await this.env.MAIN_APP.listCats();
        return {
          content: [{ type: "text", text: JSON.stringify({ cats }) }],
        };
      },
    );

    this.server.registerTool(
      "get_cat_profile",
      {
        title: "猫のプロフィールを取得",
        description: "指定した ID の猫のプロフィールを1件取得する。",
        inputSchema: {
          catId: z.string().describe("猫の ID（list_cats で取得できる）"),
        },
      },
      async ({ catId }) => {
        const cat = await this.env.MAIN_APP.getCatProfile(catId);
        if (!cat) {
          return {
            content: [
              { type: "text", text: `catId="${catId}" の猫が見つかりません` },
            ],
            isError: true,
          };
        }
        return { content: [{ type: "text", text: JSON.stringify(cat) }] };
      },
    );

    this.server.registerTool(
      "list_timeline",
      {
        title: "猫のタイムラインを取得",
        description:
          "指定した猫の、指定した年月の記録（ごはん・うんち・体重・通院・投薬など）を" +
          "発生日時の降順で取得する。",
        inputSchema: {
          catId: z.string().describe("猫の ID（list_cats で取得できる）"),
          year: z.number().int().describe("年（例: 2026）"),
          month: z.number().int().min(1).max(12).describe("月（1〜12）"),
          date: z
            .string()
            .optional()
            .describe(
              "YYYY-MM-DD形式。指定すると月内のこの日の記録だけに絞り込む",
            ),
          page: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("ページ番号（1始まり、省略時は1）"),
        },
      },
      async ({ catId, year, month, date, page }) => {
        const result = await this.env.MAIN_APP.listTimeline(
          catId,
          year,
          month,
          { date, page },
        );
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      },
    );
  }
}
