import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  type FeedingPreset,
  feedingPresetItems,
  feedingPresets,
  foodProducts,
  GIVEN_AMOUNT_LEVELS,
  householdMembers,
} from "@/db/schema";
import {
  createFeedingPreset,
  deleteFeedingPreset,
  updateFeedingPreset,
} from "@/features/feeding-presets/mutations";
import { feedingPresetFormSchema } from "@/features/feeding-presets/schema";
import {
  type FormValues,
  mergeFormValues,
  parseFormValues,
} from "../formValues";
import {
  isHouseholdAllowedForMcp,
  type McpHouseholdOperation,
} from "../permissionRules";
import {
  checkHouseholdOperation,
  errorResult,
  householdNotFoundMessage,
  jsonResult,
  type McpConnection,
  type McpToolContext,
  resolveHouseholdIdsForOperation,
  resolveHouseholdOperation,
  resolvePermissions,
} from "./context";

const PRESET_DESCRIPTION =
  "プリセットは、ごはんの記録で選ぶ商品と量の組み合わせ。" +
  'mode="strict"（厳格モード）では各商品に givenAmountG（与える量、g）を、' +
  'mode="approximate"（あいまいモード）では givenAmountLevel（less=少なめ、normal=普通、more=多め）を指定する。' +
  "商品はプリセットの家のごはん商品に限る。";

const presetFields = {
  name: z.string().optional().describe("プリセット名（100文字以内）"),
  mode: z.enum(["strict", "approximate"]).optional(),
  items: z
    .array(
      z.object({
        foodProductId: z
          .string()
          .describe("ごはん商品の ID（list_food_products で取得できる）"),
        givenAmountG: z
          .number()
          .optional()
          .describe("与える量（g、厳格モード）"),
        givenAmountLevel: z
          .enum(GIVEN_AMOUNT_LEVELS)
          .optional()
          .describe("与える量（あいまいモード）"),
      }),
    )
    .optional(),
};

type PresetItemRow = {
  presetId: string;
  foodProductId: string;
  foodProductName: string;
  givenAmountG: number | null;
  givenAmountLevel: (typeof GIVEN_AMOUNT_LEVELS)[number] | null;
};

async function listPresetItems(
  db: ReturnType<typeof getDb>,
  presetIds: string[],
): Promise<PresetItemRow[]> {
  const rows: PresetItemRow[] = [];
  for (const ids of chunkForBoundParameters(presetIds)) {
    rows.push(
      ...(await db
        .select({
          presetId: feedingPresetItems.presetId,
          foodProductId: feedingPresetItems.foodProductId,
          foodProductName: foodProducts.name,
          givenAmountG: feedingPresetItems.givenAmountG,
          givenAmountLevel: feedingPresetItems.givenAmountLevel,
        })
        .from(feedingPresetItems)
        .innerJoin(
          foodProducts,
          eq(feedingPresetItems.foodProductId, foodProducts.id),
        )
        .where(inArray(feedingPresetItems.presetId, ids))
        .orderBy(asc(feedingPresetItems.sortOrder))),
    );
  }
  return rows;
}

/**
 * ユーザーが所属し、読み取りを許可している家のプリセットで、その家で操作も許可しているときに
 * プリセットを読む。行えなければ AI に返すエラーメッセージ
 */
async function resolvePreset(
  ctx: McpToolContext,
  operation: McpHouseholdOperation,
  id: string,
): Promise<
  | { connection: McpConnection; preset: FeedingPreset; householdId: string }
  | { error: string }
> {
  const resolved = await resolvePermissions(ctx);
  if ("error" in resolved) {
    return resolved;
  }
  const [row] = await getDb(ctx.env.DB)
    .select({ preset: feedingPresets })
    .from(feedingPresets)
    .innerJoin(
      householdMembers,
      eq(feedingPresets.householdId, householdMembers.householdId),
    )
    .where(
      and(
        eq(feedingPresets.id, id),
        eq(householdMembers.userId, resolved.connection.userId),
      ),
    )
    .limit(1);
  const householdId = row?.preset.householdId;
  if (
    !householdId ||
    !isHouseholdAllowedForMcp(resolved.permissions, householdId)
  ) {
    return { error: `id="${id}" のプリセットが見つかりません` };
  }
  const operationError = await checkHouseholdOperation(
    ctx,
    resolved,
    householdId,
    operation,
  );
  if (operationError) {
    return { error: operationError };
  }
  return { connection: resolved.connection, preset: row.preset, householdId };
}

/** フォームの値に含めない引数を除く */
function formArgs(args: Record<string, unknown>) {
  const { id: _id, householdId: _householdId, ...rest } = args;
  return rest;
}

/**
 * ごはんのプリセットの読み取り・追加・編集・削除のツールを登録する。扱えるのは、読み取りを
 * 許可している家で、その操作を許可している家のプリセットに限る
 */
export function registerFeedingPresetTools(
  server: McpServer,
  ctx: McpToolContext,
) {
  server.registerTool(
    "list_feeding_presets",
    {
      title: "ごはんのプリセットの一覧を取得",
      description:
        "家のごはんのプリセット（商品と量の組み合わせ）の一覧を新しい順に取得する。" +
        "householdId を指定するとその家のプリセットに絞り込む。" +
        "ユーザーがプリセットの読み取りを許可している家のプリセットだけを含む。",
      inputSchema: {
        householdId: z
          .string()
          .optional()
          .describe("家の ID（list_households で取得できる）"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ householdId }) => {
      const resolved = await resolveHouseholdIdsForOperation(
        ctx,
        "feedingPreset:read",
        householdId,
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const { householdIds } = resolved;
      const db = getDb(ctx.env.DB);
      const presets = await db
        .select()
        .from(feedingPresets)
        .where(inArray(feedingPresets.householdId, householdIds))
        .orderBy(desc(feedingPresets.createdAt));
      const items = await listPresetItems(
        db,
        presets.map((preset) => preset.id),
      );
      return jsonResult({
        feedingPresets: presets.map((preset) => ({
          id: preset.id,
          householdId: preset.householdId,
          name: preset.name,
          mode: preset.mode,
          items: items
            .filter((item) => item.presetId === preset.id)
            .map(({ presetId: _presetId, ...item }) => item),
        })),
      });
    },
  );

  server.registerTool(
    "create_feeding_preset",
    {
      title: "ごはんのプリセットを追加",
      description:
        "家にごはんのプリセットを 1 件追加し、追加したプリセットの ID を返す。" +
        "name・mode・items は必須。" +
        PRESET_DESCRIPTION,
      inputSchema: {
        householdId: z
          .string()
          .describe(
            "プリセットを追加する家の ID（list_households で取得できる）",
          ),
        ...presetFields,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const resolved = await resolveHouseholdOperation(
        ctx,
        args.householdId,
        "feedingPreset:create",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const parsed = parseFormValues(
        feedingPresetFormSchema,
        mergeFormValues({}, formArgs(args)),
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const saved = await createFeedingPreset(
        resolved.connection.userId,
        args.householdId,
        parsed.data,
        ctx.env.DB,
      );
      if ("householdError" in saved) {
        return errorResult(householdNotFoundMessage(args.householdId));
      }
      if ("error" in saved) {
        return errorResult(saved.error);
      }
      return jsonResult({ id: saved.id });
    },
  );

  server.registerTool(
    "update_feeding_preset",
    {
      title: "ごはんのプリセットを編集",
      description:
        "ごはんのプリセットを 1 件編集する。指定した項目だけを変更し、省略した項目は今の値のまま。" +
        "items を指定すると、商品の明細をすべて置き換える。" +
        PRESET_DESCRIPTION,
      inputSchema: {
        id: z
          .string()
          .describe("プリセットの ID（list_feeding_presets で取得できる）"),
        ...presetFields,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      const resolved = await resolvePreset(
        ctx,
        "feedingPreset:update",
        args.id,
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const db = getDb(ctx.env.DB);
      const items = await listPresetItems(db, [args.id]);
      const current: FormValues = {
        name: resolved.preset.name,
        mode: resolved.preset.mode,
        items: items.map((item) => ({
          foodProductId: item.foodProductId,
          givenAmountG: item.givenAmountG ?? undefined,
          givenAmountLevel: item.givenAmountLevel ?? undefined,
        })),
      };
      const parsed = parseFormValues(
        feedingPresetFormSchema,
        mergeFormValues(current, formArgs(args)),
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const saved = await updateFeedingPreset(
        resolved.connection.userId,
        args.id,
        parsed.data,
        ctx.env.DB,
      );
      if (!("id" in saved)) {
        return errorResult(
          "error" in saved ? saved.error : saved.householdError,
        );
      }
      return jsonResult({ id: saved.id });
    },
  );

  server.registerTool(
    "delete_feeding_preset",
    {
      title: "ごはんのプリセットを削除",
      description:
        "ごはんのプリセットを 1 件削除する。プリセットから記録したごはんの記録は消えない。",
      inputSchema: {
        id: z
          .string()
          .describe("プリセットの ID（list_feeding_presets で取得できる）"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async ({ id }) => {
      const resolved = await resolvePreset(ctx, "feedingPreset:delete", id);
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      if (
        !(await deleteFeedingPreset(resolved.connection.userId, id, ctx.env.DB))
      ) {
        return errorResult(`id="${id}" のプリセットが見つかりません`);
      }
      return jsonResult({ id, deleted: true });
    },
  );
}
