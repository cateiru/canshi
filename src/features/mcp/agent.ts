import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { getUserById } from "@/features/auth/users";
import { getCatForUser, listCatsForUser } from "@/features/households/queries";
import { listTimelineForMonth } from "@/features/timeline/queries";
import {
  allowedMcpRecordTypes,
  isCatAllowedForMcp,
  MCP_ALWAYS_ALLOWED_TIMELINE_TYPES,
} from "./permissionRules";
import { getMcpPermissions } from "./permissions";
import {
  getClientIdFromProps,
  getUserIdFromProps,
  type McpProps,
  MISSING_CLIENT_ERROR_MESSAGE,
  MISSING_USER_ERROR_MESSAGE,
} from "./props";
import { toCatSummary, toTimelineEntrySummary } from "./summaries";

function errorResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    isError: true,
  };
}

function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

/** 猫のプロフィールを返すツールの説明に添える、生年月日の精度の補足 */
const BIRTH_DATE_PRECISION_DESCRIPTION =
  "birthDatePrecision は生年月日のわかっている範囲（year=年のみ、month=年月のみ、" +
  "day=年月日すべて）で、year・month の場合 birthDate の不明な月・日は 1月・1日で補完されている。";

/**
 * CANSHI の MCP サーバー本体（`/mcp`）。読み取り専用ツール（猫のプロフィール参照・
 * タイムライン参照）を公開する。書き込み系ツールは対象外
 * （docs/plans/32_mcp_oidc_overview.md 参照）。
 *
 * 各ツールはトークンに保存した CANSHI のユーザー ID（`this.props.userId`、
 * `/oauth/authorize` で同意したときにログインしていたユーザー）の家の猫のうち、
 * そのユーザーがこの接続（`this.props.clientId`）に読み取りを許可した家・猫・記録の種類
 * （`./permissions.ts`）だけを参照する。
 * 許可していない猫は、存在しない猫と区別しない。
 * Durable Object の中で動くため、D1 は `getCloudflareContext()` ではなく
 * `this.env.DB` を明示的に渡す
 */
export class CanshiMcp extends McpAgent<Env, Record<string, never>, McpProps> {
  server = new McpServer({ name: "CANSHI MCP Server", version: "0.1.0" });

  /**
   * ツールを呼んだユーザーの ID と、接続（OAuth のクライアント）の ID。読み取りの範囲は
   * 接続ごとに設定する。ユーザー ID を持たないトークンや、削除されたユーザーのトークン、
   * 接続を求められなかったリクエスト（`./clientId.ts`）では、ツールの結果として返す
   * エラーメッセージを返す。接続が分からないまま範囲を決めると、制限した範囲を
   * 読み取れてしまうため、読み取りを断る
   */
  private async resolveConnection(): Promise<
    { userId: string; clientId: string } | { error: string }
  > {
    const userId = getUserIdFromProps(this.props);
    if (!userId) {
      return { error: MISSING_USER_ERROR_MESSAGE };
    }
    const clientId = getClientIdFromProps(this.props);
    if (!clientId) {
      return { error: MISSING_CLIENT_ERROR_MESSAGE };
    }
    if (!(await getUserById(userId, this.env.DB))) {
      return {
        error: "ユーザーが見つかりません。MCP に接続し直してください",
      };
    }
    return { userId, clientId };
  }

  /**
   * ユーザーが参照でき、この接続からの読み取りも許可している猫と、その猫について
   * 読み取れる記録の種類を返す。どちらかを満たさなければ null
   */
  private async resolveAllowedCat(
    connection: { userId: string; clientId: string },
    catId: string,
  ) {
    const [cat, permissions] = await Promise.all([
      getCatForUser(connection.userId, catId, this.env.DB),
      getMcpPermissions(connection.userId, connection.clientId, this.env.DB),
    ]);
    if (!cat || !isCatAllowedForMcp(permissions, cat)) {
      return null;
    }
    return { cat, recordTypes: allowedMcpRecordTypes(permissions, cat.id) };
  }

  async init() {
    this.server.registerTool(
      "list_cats",
      {
        title: "猫の一覧を取得",
        description:
          "登録されている猫のプロフィール一覧を取得する。" +
          "ユーザーが読み取りを許可していない猫は含まれない。" +
          BIRTH_DATE_PRECISION_DESCRIPTION,
      },
      async () => {
        const connection = await this.resolveConnection();
        if ("error" in connection) {
          return errorResult(connection.error);
        }
        const [cats, permissions] = await Promise.all([
          listCatsForUser(connection.userId, this.env.DB),
          getMcpPermissions(
            connection.userId,
            connection.clientId,
            this.env.DB,
          ),
        ]);
        return jsonResult({
          cats: cats
            .filter((cat) => isCatAllowedForMcp(permissions, cat))
            .map(toCatSummary),
        });
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
        const connection = await this.resolveConnection();
        if ("error" in connection) {
          return errorResult(connection.error);
        }
        const allowed = await this.resolveAllowedCat(connection, catId);
        if (!allowed) {
          return errorResult(`catId="${catId}" の猫が見つかりません`);
        }
        return jsonResult(toCatSummary(allowed.cat));
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
          "それぞれの日本語ラベルは modeLabel・givenAmountLevelLabel・leftoverLevelLabel に含まれる。" +
          "ユーザーが読み取りを許可していない種類の記録は含まれない。",
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
        const connection = await this.resolveConnection();
        if ("error" in connection) {
          return errorResult(connection.error);
        }
        // 別の家の猫・読み取りを許可していない猫・存在しない猫は区別しない
        const allowed = await this.resolveAllowedCat(connection, catId);
        if (!allowed) {
          return errorResult(`catId="${catId}" の猫が見つかりません`);
        }
        const result = await listTimelineForMonth(
          catId,
          year,
          month,
          {
            date,
            page,
            types: [
              ...MCP_ALWAYS_ALLOWED_TIMELINE_TYPES,
              ...allowed.recordTypes,
            ],
          },
          this.env.DB,
        );
        return jsonResult({
          entries: result.entries.map(toTimelineEntrySummary),
          hasMore: result.hasMore,
        });
      },
    );
  }
}
