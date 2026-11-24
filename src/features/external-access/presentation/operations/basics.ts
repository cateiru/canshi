import { z } from "zod";
import {
  getCatForUser,
  listCatsForUser,
} from "@/features/households/infrastructure/queries";
import {
  listRecordContributors,
  recordContributorKey,
} from "@/features/record-contributors/infrastructure/queries";
import { getTimelineRecordChangeLogType } from "@/features/timeline/domain/timelineEntry";
import { listTimelineForMonth } from "@/features/timeline/infrastructure/queries";
import {
  ALWAYS_ALLOWED_TIMELINE_TYPES,
  allowedRecordTypes,
  HOUSEHOLD_OPERATIONS,
  isCatAllowed,
} from "../../domain/permissionRules";
import {
  catNotFoundError,
  listAllowedHouseholds,
  type OperationContext,
} from "./context";
import { errorResult, jsonResult, type OperationRegistry } from "./registry";
import {
  CHANGE_HISTORY_DESCRIPTION,
  toCatSummary,
  toTimelineEntrySummary,
} from "./summaries";

/** 猫のプロフィールを返す操作の説明に添える、生年月日の精度の補足 */
const BIRTH_DATE_PRECISION_DESCRIPTION =
  "birthDatePrecision は生年月日のわかっている範囲（year=年のみ、month=年月のみ、" +
  "day=年月日すべて）で、year・month の場合 birthDate の不明な月・日は 1月・1日で補完されている。" +
  "memorialDate はユーザーが猫をメモリー（思い出）へ移した日（YYYY-MM-DD）で、null なら移していない。" +
  "メモリーへ移した猫は、旅立った猫を思い出として残しているもので、記録やプロフィールは読み取れるが、" +
  "記録の追加・編集やプロフィール・通知の設定の変更はできない。";

/**
 * ユーザーが参照でき、読み取りも許可している猫と、その猫について読み取れる記録の種類を返す。
 * 別の家の猫・読み取りを許可していない猫・存在しない猫は区別しない
 */
async function resolveAllowedCat(ctx: OperationContext, catId: string) {
  const access = await ctx.resolveAccess();
  if ("error" in access) {
    return access;
  }
  const cat = await getCatForUser(access.userId, catId, ctx.env.DB);
  if (!cat || !isCatAllowed(access.permissions, cat)) {
    return { error: catNotFoundError(catId) };
  }
  return {
    userId: access.userId,
    cat,
    recordTypes: allowedRecordTypes(access.permissions, cat.id),
  };
}

/** 家・猫・タイムラインを読み取る操作を登録する */
export function registerBasicOperations(
  registry: OperationRegistry,
  ctx: OperationContext,
) {
  registry.register(
    "list_households",
    {
      title: "家の一覧を取得",
      description:
        "ユーザーが所属している家の一覧を取得する。ごはん商品・プリセット・ごはんの時間は家ごとに登録する。" +
        "role はユーザーの家での役割（owner=オーナー、member=メンバー）。" +
        `operations は、その家で${ctx.caller.name}に許可されている操作` +
        `（${HOUSEHOLD_OPERATIONS.join("・")}）。` +
        "cat:update・catNotification:read・catNotification:update はその家の猫について行える。" +
        "ユーザーが読み取りを許可していない家は含まれない。",
      annotations: { readOnlyHint: true },
    },
    async () => {
      const access = await ctx.resolveAccess();
      if ("error" in access) {
        return errorResult(access.error);
      }
      const { userId, permissions } = access;
      const households = await listAllowedHouseholds(ctx, userId, permissions);
      return jsonResult({
        households: households.map((household) => ({
          id: household.id,
          name: household.name,
          role: household.role,
          operations: permissions.householdOperations[household.id] ?? [],
        })),
      });
    },
  );

  registry.register(
    "list_cats",
    {
      title: "猫の一覧を取得",
      description:
        "登録されている猫のプロフィール一覧を取得する。" +
        "ユーザーが読み取りを許可していない猫は含まれない。" +
        BIRTH_DATE_PRECISION_DESCRIPTION,
    },
    async () => {
      const access = await ctx.resolveAccess();
      if ("error" in access) {
        return errorResult(access.error);
      }
      const { userId, permissions } = access;
      const cats = await listCatsForUser(userId, ctx.env.DB);
      return jsonResult({
        cats: cats
          .filter((cat) => isCatAllowed(permissions, cat))
          .map(toCatSummary),
      });
    },
  );

  registry.register(
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
      const allowed = await resolveAllowedCat(ctx, catId);
      if ("error" in allowed) {
        return errorResult(allowed.error);
      }
      return jsonResult(toCatSummary(allowed.cat));
    },
  );

  registry.register(
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
        'メモリー（思い出）へ移した猫では、移した日に type="memorial" のエントリ' +
        "（record.date に移した日）が入り、それより後の記録・記念日は含まない。" +
        '体重記録（type="weight"）には猫の体重 catWeightKg に加え、' +
        "BCS（ボディコンディションスコア）の bcs（1〜5 の 5 段階。1=痩せ、" +
        "2=やや痩せ、3=理想体重、4=やや肥満、5=肥満。未評価は null）と" +
        "そのラベル bcsLabel が含まれる。" +
        'ごはん記録（type="feeding"）は record.mode で記録方法を表す。' +
        'mode="strict"（厳格モード）は商品ごと（record.items）の与えた量 givenAmountG・' +
        "残した量 leftoverAmountG を商品の単位 amountUnit（g か ml。ml はスープ・ミルクなど）で持ち、" +
        "推定摂取量 estimatedIntakeG（同じ単位）・推定カロリー estimatedKcal も計算済み。" +
        "g と ml の量は足さない（画面では g の商品を食べた量、ml の商品を飲んだ量として分けて表示する）。" +
        'mode="approximate"（あいまいモード）は量の値と推定値がすべて null で、' +
        "代わりに与えた量 givenAmountLevel（less=少なめ、normal=普通、more=多め）と" +
        "残した量 leftoverLevel（none=完食、little=少し残し、most=ほとんど残し）を持つ。" +
        "それぞれの日本語ラベルは modeLabel・givenAmountLevelLabel・leftoverLevelLabel に含まれる。" +
        'ブラッシング記録（type="brushing"）の shedAmount（抜け毛の量）は less=少ない、' +
        "usual=いつも通り、more=多い（未選択は null）。" +
        'メモ（type="memo"）は日付を残したものだけを含む。日付を残さないメモも読むときは list_memos を使う。' +
        "記念日・メモリーのエントリを除く記録には、誰がいつ作成・編集したかの changeHistory が含まれる。" +
        CHANGE_HISTORY_DESCRIPTION +
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
      const allowed = await resolveAllowedCat(ctx, catId);
      if ("error" in allowed) {
        return errorResult(allowed.error);
      }
      const result = await listTimelineForMonth(
        catId,
        year,
        month,
        {
          date,
          page,
          types: [...ALWAYS_ALLOWED_TIMELINE_TYPES, ...allowed.recordTypes],
        },
        ctx.env.DB,
      );
      const contributions = await listRecordContributors(
        result.entries.flatMap((entry) => {
          const recordType = getTimelineRecordChangeLogType(entry.type);
          return recordType ? [{ recordType, recordId: entry.id }] : [];
        }),
        allowed.userId,
        ctx.env.DB,
      );
      return jsonResult({
        entries: result.entries.map((entry) => {
          const recordType = getTimelineRecordChangeLogType(entry.type);
          return toTimelineEntrySummary(
            entry,
            recordType
              ? (contributions.get(
                  recordContributorKey(recordType, entry.id),
                ) ?? null)
              : undefined,
          );
        }),
        hasMore: result.hasMore,
      });
    },
  );
}
