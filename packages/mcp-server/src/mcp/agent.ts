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

/** 猫のプロフィールを返すツールの説明に添える、生年月日の精度の補足 */
const BIRTH_DATE_PRECISION_DESCRIPTION =
  "birthDatePrecision は生年月日のわかっている範囲（year=年のみ、month=年月のみ、" +
  "day=年月日すべて）で、year・month の場合 birthDate の不明な月・日は 1月・1日で補完されている。";

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
        description:
          "登録されている猫のプロフィール一覧を取得する。" +
          BIRTH_DATE_PRECISION_DESCRIPTION,
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
        description:
          "指定した ID の猫のプロフィールを1件取得する。" +
          BIRTH_DATE_PRECISION_DESCRIPTION,
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
          "発生日時の降順で取得する。" +
          '猫の生年月日・お迎え日から求めた記念日も含む。誕生日（type="birthday"）は' +
          "record.ageMonths に生まれてからの月数（0=生まれた日、12 の倍数=毎年の誕生日、" +
          '1〜11=1歳未満の毎月の記念日）を、お迎え記念日（type="adoption"）は' +
          "record.years にお迎えしてからの年数（0=お迎えした日）を持ち、" +
          "同じ日の記録より先頭に並ぶ。" +
          '体重記録（type="weight"）には猫の体重 catWeightKg に加え、' +
          "BCS（ボディコンディションスコア）の bcs（1〜5 の 5 段階。1=痩せ、" +
          "2=やや痩せ、3=理想体重、4=やや肥満、5=肥満。未評価は null）と" +
          "そのラベル bcsLabel が含まれる。" +
          'ごはん記録（type="feeding"）は record.mode で記録方法を表す。' +
          'mode="strict"（厳格モード）は商品ごと（record.items）の与えた量 givenAmountG・' +
          "残した量 leftoverAmountG をグラム単位で持ち、推定摂取量 estimatedIntakeG・" +
          "推定カロリー estimatedKcal も計算済み。" +
          'mode="approximate"（あいまいモード）はグラム単位の値と推定値がすべて null で、' +
          "代わりに与えた量 givenAmountLevel（less=少なめ、normal=普通、more=多め）と" +
          "残した量 leftoverLevel（none=完食、little=少し残し、most=ほとんど残し）を持つ。" +
          "それぞれの日本語ラベルは modeLabel・givenAmountLevelLabel・leftoverLevelLabel に含まれる。",
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
