import type { Cat } from "@/db/schema";
import {
  getCatForUser,
  listHouseholdsForUser,
} from "@/features/households/queries";
import {
  isCatAllowedForMcp,
  isHouseholdAllowedForMcp,
  isHouseholdOperationAllowedForMcp,
  type McpHouseholdOperation,
  type McpPermissionRecordType,
  type McpPermissions,
  writableMcpRecordTypes,
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
const OPERATION_LABEL: Record<McpHouseholdOperation, string> = {
  "foodProduct:read": "ごはん商品の読み取り",
  "foodProduct:create": "ごはん商品の追加",
  "foodProduct:update": "ごはん商品の編集",
  "feedingPreset:read": "ごはんのプリセットの読み取り",
  "feedingPreset:create": "ごはんのプリセットの追加",
  "feedingPreset:update": "ごはんのプリセットの編集",
  "feedingPreset:delete": "ごはんのプリセットの削除",
};

const ASK_USER_TO_ALLOW =
  "CANSHI の設定の「AIとの接続」で、ユーザーに許可してもらってください";

export function operationNotAllowedMessage(
  operation: McpHouseholdOperation,
  householdName?: string,
) {
  const target = householdName ? `家「${householdName}」での` : "";
  return (
    `この接続には${target}「${OPERATION_LABEL[operation]}」が許可されていません。` +
    ASK_USER_TO_ALLOW
  );
}

export function catNotFoundMessage(catId: string) {
  return `catId="${catId}" の猫が見つかりません`;
}

/** 接続を求め、その接続の範囲を返す。求められなければ AI に返すエラーメッセージ */
export async function resolvePermissions(
  ctx: McpToolContext,
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
  return { connection, permissions };
}

/**
 * 記録を書き込む猫を求める。ユーザーが参照でき、この接続からの読み取りを許可している猫で、
 * その記録の種類の書き込みも許可しているときに限る。読み取りを許可していない猫は、
 * 存在しない猫と区別しない
 */
export async function resolveWritableCat(
  ctx: McpToolContext,
  catId: string,
  recordType: McpPermissionRecordType,
  recordLabel: string,
): Promise<
  | {
      connection: McpConnection;
      permissions: McpPermissions;
      cat: Cat & { householdId: string };
    }
  | { error: string }
> {
  const resolved = await resolvePermissions(ctx);
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
    !writableMcpRecordTypes(resolved.permissions, cat.id).includes(recordType)
  ) {
    return {
      error:
        `この接続には、この猫の${recordLabel}の書き込みが許可されていません。` +
        ASK_USER_TO_ALLOW,
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

/**
 * 家で操作を行えるかを確かめ、行えなければ AI に返すエラーメッセージを返す。ユーザーが所属し、
 * この接続からの読み取りを許可している家で、その操作も許可しているときに限る。
 * 読み取りを許可していない家は、存在しない家と区別しない
 */
export async function checkHouseholdOperation(
  ctx: McpToolContext,
  resolved: { connection: McpConnection; permissions: McpPermissions },
  householdId: string,
  operation: McpHouseholdOperation,
): Promise<string | null> {
  const households = await listAllowedHouseholds(
    ctx,
    resolved.connection.userId,
    resolved.permissions,
  );
  const household = households.find(({ id }) => id === householdId);
  if (!household) {
    return householdNotFoundMessage(householdId);
  }
  if (
    !isHouseholdOperationAllowedForMcp(
      resolved.permissions,
      householdId,
      operation,
    )
  ) {
    return operationNotAllowedMessage(operation, household.name);
  }
  return null;
}

/** 接続を求め、家で操作を行えるときだけ接続と範囲を返す（`checkHouseholdOperation` 参照） */
export async function resolveHouseholdOperation(
  ctx: McpToolContext,
  householdId: string,
  operation: McpHouseholdOperation,
): Promise<
  { connection: McpConnection; permissions: McpPermissions } | { error: string }
> {
  const resolved = await resolvePermissions(ctx);
  if ("error" in resolved) {
    return resolved;
  }
  const error = await checkHouseholdOperation(
    ctx,
    resolved,
    householdId,
    operation,
  );
  return error ? { error } : resolved;
}

/**
 * 一覧のツールで、操作（読み取り）を許可している家の ID を求める。`householdId` を指定したときは
 * その家だけにする。どの家でも許可していなければ AI に返すエラーメッセージ
 */
export async function resolveHouseholdIdsForOperation(
  ctx: McpToolContext,
  operation: McpHouseholdOperation,
  householdId: string | undefined,
): Promise<{ householdIds: string[] } | { error: string }> {
  const resolved = await resolvePermissions(ctx);
  if ("error" in resolved) {
    return resolved;
  }
  if (householdId !== undefined) {
    const error = await checkHouseholdOperation(
      ctx,
      resolved,
      householdId,
      operation,
    );
    return error ? { error } : { householdIds: [householdId] };
  }
  const households = await listAllowedHouseholds(
    ctx,
    resolved.connection.userId,
    resolved.permissions,
  );
  const householdIds = households
    .map(({ id }) => id)
    .filter((id) =>
      isHouseholdOperationAllowedForMcp(resolved.permissions, id, operation),
    );
  if (householdIds.length === 0) {
    return { error: operationNotAllowedMessage(operation) };
  }
  return { householdIds };
}
