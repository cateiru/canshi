import { z } from "zod";
import { type FeedingPreset, GIVEN_AMOUNT_LEVELS } from "@/db/schema";
import {
  createFeedingPreset,
  deleteFeedingPreset,
  updateFeedingPreset,
} from "@/features/feeding-presets/application/mutations";
import { feedingPresetFormSchema } from "@/features/feeding-presets/domain/schema";
import {
  getFeedingPresetRowForUser,
  listFeedingPresetItemSummaries,
  listFeedingPresetsByHouseholdIds,
} from "@/features/feeding-presets/infrastructure/queries";
import {
  type HouseholdOperation,
  isHouseholdAllowed,
} from "../../domain/permissionRules";
import {
  checkHouseholdOperation,
  householdNotFoundError,
  type OperationContext,
  resolveHouseholdIdsForOperation,
  resolveHouseholdOperation,
} from "./context";
import {
  type FormValues,
  mergeFormValues,
  parseFormValues,
} from "./formValues";
import {
  errorResult,
  jsonResult,
  notFoundError,
  type OperationError,
  type OperationRegistry,
} from "./registry";

const PRESET_DESCRIPTION =
  "プリセットは、ごはんの記録で選ぶ商品と量の組み合わせ。" +
  'mode="strict"（厳格モード）では各商品に givenAmountG（与える量。商品の amountUnit の単位で g か ml）を、' +
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
          .describe(
            "与える量（商品の amountUnit の単位。g か ml、厳格モード）",
          ),
        givenAmountLevel: z
          .enum(GIVEN_AMOUNT_LEVELS)
          .optional()
          .describe("与える量（あいまいモード）"),
      }),
    )
    .optional(),
};

function presetNotFoundError(id: string) {
  return notFoundError(`id="${id}" のプリセットが見つかりません`);
}

/**
 * ユーザーが所属し、読み取りを許可している家のプリセットで、その家で操作も許可しているときに
 * プリセットを読む。行えなければ 結果として返すエラー
 */
async function resolvePreset(
  ctx: OperationContext,
  operation: HouseholdOperation,
  id: string,
): Promise<
  | { userId: string; preset: FeedingPreset; householdId: string }
  | { error: OperationError }
> {
  const resolved = await ctx.resolveAccess();
  if ("error" in resolved) {
    return resolved;
  }
  const preset = await getFeedingPresetRowForUser(
    resolved.userId,
    id,
    ctx.env.DB,
  );
  const householdId = preset?.householdId;
  if (!householdId || !isHouseholdAllowed(resolved.permissions, householdId)) {
    return { error: presetNotFoundError(id) };
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
  return { userId: resolved.userId, preset, householdId };
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
export function registerFeedingPresetOperations(
  registry: OperationRegistry,
  ctx: OperationContext,
) {
  registry.register(
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
      const presets = await listFeedingPresetsByHouseholdIds(
        householdIds,
        ctx.env.DB,
      );
      const items = await listFeedingPresetItemSummaries(
        presets.map((preset) => preset.id),
        ctx.env.DB,
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

  registry.register(
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
        resolved.userId,
        args.householdId,
        parsed.data,
        ctx.env.DB,
      );
      if ("householdError" in saved) {
        return errorResult(householdNotFoundError(args.householdId));
      }
      if ("error" in saved) {
        return errorResult(saved.error);
      }
      return jsonResult({ id: saved.id });
    },
  );

  registry.register(
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
      const items = await listFeedingPresetItemSummaries([args.id], ctx.env.DB);
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
        resolved.userId,
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

  registry.register(
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
      if (!(await deleteFeedingPreset(resolved.userId, id, ctx.env.DB))) {
        return errorResult(presetNotFoundError(id));
      }
      return jsonResult({ id, deleted: true });
    },
  );
}
