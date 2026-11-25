import { z } from "zod";
import { MEMO_LABEL_COLORS, type MemoLabel } from "@/db/schema";
import {
  createMemoLabel,
  deleteMemoLabel,
  updateMemoLabel,
} from "@/features/memo-records/application/labelMutations";
import {
  MEMO_LABEL_NAME_MAX_LENGTH,
  memoLabelFormSchema,
} from "@/features/memo-records/domain/labelSchema";
import {
  MEMO_LABEL_DUPLICATE_NAME_ERROR,
  memoLabelInUseMessage,
} from "@/features/memo-records/domain/labels";
import {
  getMemoLabelForUser,
  listMemoLabelsWithCount,
} from "@/features/memo-records/infrastructure/labelQueries";
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
import { mergeFormValues, parseFormValues } from "./formValues";
import {
  conflictError,
  errorResult,
  jsonResult,
  notFoundError,
  type OperationError,
  type OperationRegistry,
} from "./registry";

const labelFields = {
  name: z
    .string()
    .optional()
    .describe(
      `ラベルの名前（${MEMO_LABEL_NAME_MAX_LENGTH}文字以内）。同じ家に同じ名前のラベルは作れない`,
    ),
  color: z
    .enum(MEMO_LABEL_COLORS)
    .optional()
    .describe("ラベルの色。追加で省略すると gray"),
};

function labelNotFoundError(id: string) {
  return notFoundError(`id="${id}" のラベルが見つかりません`);
}

/**
 * ユーザーが所属し、読み取りを許可している家のラベルで、その家で操作も許可しているときに
 * ラベルを読む。行えなければ結果として返すエラー
 */
async function resolveLabel(
  ctx: OperationContext,
  operation: HouseholdOperation,
  id: string,
): Promise<{ userId: string; label: MemoLabel } | { error: OperationError }> {
  const resolved = await ctx.resolveAccess();
  if ("error" in resolved) {
    return resolved;
  }
  const label = await getMemoLabelForUser(resolved.userId, id, ctx.env.DB);
  if (!label || !isHouseholdAllowed(resolved.permissions, label.householdId)) {
    return { error: labelNotFoundError(id) };
  }
  const operationError = await checkHouseholdOperation(
    ctx,
    resolved,
    label.householdId,
    operation,
  );
  if (operationError) {
    return { error: operationError };
  }
  return { userId: resolved.userId, label };
}

/**
 * メモのラベルの読み取り・追加・編集・削除の操作を登録する。扱えるのは、読み取りを
 * 許可している家で、その操作を許可している家のラベルに限る。
 * メモにラベルを付ける・外すのは、メモの追加・編集（`./records.ts`）で行う
 */
export function registerMemoLabelOperations(
  registry: OperationRegistry,
  ctx: OperationContext,
) {
  registry.register(
    "list_memo_labels",
    {
      title: "メモのラベルの一覧を取得",
      description:
        "家のメモのラベルの一覧を作った順に取得する。メモの追加・編集の labelIds、" +
        "メモの一覧（list_memos）の labelId に使う。memoCount はラベルが付いているメモの数" +
        "（読み取りを許可していない猫のメモも数える）。" +
        "householdId を指定するとその家のラベルに絞り込む。" +
        "ユーザーがメモのラベルの読み取りを許可している家のラベルだけを含む。",
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
        "memoLabel:read",
        householdId,
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const labels = await listMemoLabelsWithCount(
        resolved.householdIds,
        ctx.env.DB,
      );
      return jsonResult({
        memoLabels: labels.map((label) => ({
          id: label.id,
          householdId: label.householdId,
          name: label.name,
          color: label.color,
          memoCount: label.memoCount,
        })),
      });
    },
  );

  registry.register(
    "create_memo_label",
    {
      title: "メモのラベルを追加",
      description:
        "家にメモのラベルを 1 件追加し、追加したラベルの ID を返す。name は必須。" +
        "ラベルはその家のすべての猫のメモに付けられる。",
      inputSchema: {
        householdId: z
          .string()
          .describe("ラベルを追加する家の ID（list_households で取得できる）"),
        ...labelFields,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ householdId, ...args }) => {
      const resolved = await resolveHouseholdOperation(
        ctx,
        householdId,
        "memoLabel:create",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const parsed = parseFormValues(
        memoLabelFormSchema,
        mergeFormValues({ color: "gray" }, args),
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const saved = await createMemoLabel(
        resolved.userId,
        householdId,
        parsed.data,
        ctx.env.DB,
      );
      if ("failure" in saved) {
        return errorResult(
          saved.failure === "duplicateName"
            ? conflictError(MEMO_LABEL_DUPLICATE_NAME_ERROR)
            : householdNotFoundError(householdId),
        );
      }
      return jsonResult({ id: saved.id });
    },
  );

  registry.register(
    "update_memo_label",
    {
      title: "メモのラベルを編集",
      description:
        "メモのラベルを 1 件編集する。指定した項目だけを変更し、省略した項目は今の値のまま。" +
        "ラベルが付いているすべてのメモの表示が変わる。",
      inputSchema: {
        id: z.string().describe("ラベルの ID（list_memo_labels で取得できる）"),
        ...labelFields,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async ({ id, ...args }) => {
      const resolved = await resolveLabel(ctx, "memoLabel:update", id);
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const parsed = parseFormValues(
        memoLabelFormSchema,
        mergeFormValues(
          { name: resolved.label.name, color: resolved.label.color },
          args,
        ),
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const saved = await updateMemoLabel(
        resolved.userId,
        id,
        parsed.data,
        ctx.env.DB,
      );
      if ("failure" in saved) {
        return errorResult(
          saved.failure === "duplicateName"
            ? conflictError(MEMO_LABEL_DUPLICATE_NAME_ERROR)
            : labelNotFoundError(id),
        );
      }
      return jsonResult({ id: saved.id });
    },
  );

  registry.register(
    "delete_memo_label",
    {
      title: "メモのラベルを削除",
      description:
        "メモのラベルを 1 件削除する。メモに付いているラベルは削除できないため、" +
        "先にメモの編集（update_memo）の labelIds でラベルを外す。",
      inputSchema: {
        id: z.string().describe("ラベルの ID（list_memo_labels で取得できる）"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async ({ id }) => {
      const resolved = await resolveLabel(ctx, "memoLabel:delete", id);
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      switch (await deleteMemoLabel(resolved.userId, id, ctx.env.DB)) {
        case "deleted":
          return jsonResult({ id, deleted: true });
        case "inUse":
          return errorResult(conflictError(memoLabelInUseMessage()));
        case "notFound":
          return errorResult(labelNotFoundError(id));
      }
    },
  );
}
