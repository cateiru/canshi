import type { Cat } from "@/db/schema";
import {
  getCatForUser,
  listHouseholdsForUser,
} from "@/features/households/queries";
import {
  allowedMcpRecordTypes,
  isCatAllowedForMcp,
  isHouseholdAllowedForMcp,
  isMcpOperationAllowed,
  type McpOperation,
  type McpPermissionRecordType,
  type McpPermissions,
} from "../permissionRules";
import { getMcpPermissions } from "../permissions";

/** ツールを呼んだユーザーと、接続（OAuth のクライアント） */
export type McpConnection = { userId: string; clientId: string };

/**
 * ツールの実装に渡す、MCP サーバー（`CanshiMcp`）の環境。Durable Object の中で動くため、
 * D1・R2 は `getCloudflareContext()` ではなく `env` から明示的に渡す
 */
export interface McpToolContext {
  env: Env;
  /** ツールを呼んだユーザーと接続を求める。求められなければ AI に返すエラーメッセージ */
  resolveConnection(): Promise<McpConnection | { error: string }>;
}

export function errorResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    isError: true,
  };
}

export function jsonResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

/** 許可していない操作をしようとしたときのエラーに使う、操作の名前 */
const OPERATION_LABEL: Record<McpOperation, string> = {
  "record:create": "記録の追加",
  "record:update": "記録の編集",
  "foodProduct:read": "ごはん商品の読み取り",
  "foodProduct:create": "ごはん商品の追加",
  "foodProduct:update": "ごはん商品の編集",
  "feedingPreset:read": "ごはんのプリセットの読み取り",
  "feedingPreset:create": "ごはんのプリセットの追加",
  "feedingPreset:update": "ごはんのプリセットの編集",
  "feedingPreset:delete": "ごはんのプリセットの削除",
};

export function operationNotAllowedMessage(operation: McpOperation) {
  return (
    `この接続には「${OPERATION_LABEL[operation]}」が許可されていません。` +
    "CANSHI の設定の「AIとの接続」で、ユーザーに許可してもらってください"
  );
}

export function catNotFoundMessage(catId: string) {
  return `catId="${catId}" の猫が見つかりません`;
}

/**
 * 接続を求め、その接続に操作が許可されていれば、接続と範囲を返す。
 * 許可していなければ AI に返すエラーメッセージ
 */
export async function resolveOperation(
  ctx: McpToolContext,
  operation: McpOperation,
): Promise<
  { connection: McpConnection; permissions: McpPermissions } | { error: string }
> {
  const connection = await ctx.resolveConnection();
  if ("error" in connection) {
    return connection;
  }
  const permissions = await getMcpPermissions(
    connection.userId,
    connection.clientId,
    ctx.env.DB,
  );
  if (!isMcpOperationAllowed(permissions, operation)) {
    return { error: operationNotAllowedMessage(operation) };
  }
  return { connection, permissions };
}

/**
 * 記録を書き込む猫を求める。操作が許可されていて、ユーザーが参照でき、この接続からの
 * 読み取りも許可している猫と記録の種類に限る。読み取りを許可していない猫は、
 * 存在しない猫と区別しない
 */
export async function resolveWritableCat(
  ctx: McpToolContext,
  catId: string,
  recordType: McpPermissionRecordType,
  operation: McpOperation,
  recordLabel: string,
): Promise<
  | {
      connection: McpConnection;
      permissions: McpPermissions;
      cat: Cat & { householdId: string };
    }
  | { error: string }
> {
  const resolved = await resolveOperation(ctx, operation);
  if ("error" in resolved) {
    return resolved;
  }
  const cat = await getCatForUser(
    resolved.connection.userId,
    catId,
    ctx.env.DB,
  );
  if (
    !cat ||
    cat.householdId === null ||
    !isCatAllowedForMcp(resolved.permissions, cat)
  ) {
    return { error: catNotFoundMessage(catId) };
  }
  if (
    !allowedMcpRecordTypes(resolved.permissions, cat.id).includes(recordType)
  ) {
    return {
      error:
        `この接続には、この猫の${recordLabel}の読み取りが許可されていません。` +
        "許可している記録の種類だけを書き込めます",
    };
  }
  return { ...resolved, cat: { ...cat, householdId: cat.householdId } };
}

export function householdNotFoundMessage(householdId: string) {
  return `householdId="${householdId}" の家が見つかりません`;
}

/**
 * ユーザーが所属し、この接続からの読み取りも許可している家の一覧。
 * ごはん商品・プリセットは、この家のものだけを扱える
 */
export async function listAllowedHouseholds(
  ctx: McpToolContext,
  userId: string,
  permissions: McpPermissions,
) {
  const households = await listHouseholdsForUser(userId, ctx.env.DB);
  return households.filter((household) =>
    isHouseholdAllowedForMcp(permissions, household.id),
  );
}
