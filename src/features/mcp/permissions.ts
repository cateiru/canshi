import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { mcpPermissions } from "@/db/schema";
import {
  listCatsForUser,
  listHouseholdsForUser,
} from "@/features/households/queries";
import {
  buildMcpPermissionTree,
  DEFAULT_MCP_PERMISSIONS,
  isMcpOperation,
  isMcpPermissionRecordType,
  MCP_OPERATIONS_FIELD_NAME,
  MCP_PERMISSIONS_FIELD_NAME,
  type McpOperation,
  type McpPermissions,
  type McpPermissionTreeHousehold,
  parseMcpOperationsInput,
  parseMcpPermissionsInput,
} from "./permissionRules";

/**
 * ユーザーが許可した接続（OAuth のクライアント）の、AI から読み取れる範囲と行える操作。
 * 保存していなければすべて読み取れるが、操作はどれも行えない。MCP のツールはトークンに範囲を持たせず、呼ばれるたびに
 * これを読む。そのため設定の変更は、接続済みのアプリにもすぐに反映される
 */
export async function getMcpPermissions(
  userId: string,
  clientId: string,
  d1?: D1Database,
): Promise<McpPermissions> {
  const db = getDb(d1);
  const [row] = await db
    .select()
    .from(mcpPermissions)
    .where(permissionsKey(userId, clientId))
    .limit(1);
  if (!row) {
    return DEFAULT_MCP_PERMISSIONS;
  }
  // 保存後に記録の種類が無くなった場合に備えて、知らない種類は読み飛ばす
  const excludedRecordTypes: McpPermissions["excludedRecordTypes"] = {};
  for (const [catId, types] of Object.entries(row.excludedRecordTypes)) {
    excludedRecordTypes[catId] = types.filter(isMcpPermissionRecordType);
  }
  return {
    excludedHouseholdIds: row.excludedHouseholdIds,
    excludedCatIds: row.excludedCatIds,
    excludedRecordTypes,
    allowedOperations: row.allowedOperations.filter(isMcpOperation),
  };
}

/** 設定画面・同意画面に表示する、接続の家・猫・記録の種類のチェックの状態と、許可した操作 */
export async function getMcpPermissionSettings(
  userId: string,
  clientId: string,
  d1?: D1Database,
): Promise<{
  tree: McpPermissionTreeHousehold[];
  allowedOperations: McpOperation[];
}> {
  const [permissions, households, cats] = await Promise.all([
    getMcpPermissions(userId, clientId, d1),
    listHouseholdsForUser(userId, d1),
    listCatsForUser(userId, d1),
  ]);
  return {
    // 猫は登録した順に並べる（`listCatsForUser` は新しい順）
    tree: buildMcpPermissionTree(permissions, households, [...cats].reverse()),
    allowedOperations: permissions.allowedOperations,
  };
}

/**
 * フォームで送られた範囲（`McpPermissionTreeField`）と操作（`McpOperationsField`）を、
 * 接続の範囲として保存する。設定画面と同意画面の両方から使う。
 *
 * 範囲・操作は、フォームに項目があるものだけを保存する。家が無いときの範囲の選択や、
 * 操作の選択を追加する前に開いた同意画面からの送信では、項目が無いものは今の値のまま。
 * ユーザーが所属する家・参照できる猫以外の ID は保存しない。送られた値の形が正しくない、
 * またはどちらの項目も無ければ保存せずに false を返す
 */
export async function saveMcpPermissionsFromForm(
  userId: string,
  clientId: string,
  formData: FormData,
  d1?: D1Database,
): Promise<boolean> {
  const values: Partial<
    Pick<
      typeof mcpPermissions.$inferInsert,
      | "excludedHouseholdIds"
      | "excludedCatIds"
      | "excludedRecordTypes"
      | "allowedOperations"
    >
  > = {};

  if (formData.has(MCP_PERMISSIONS_FIELD_NAME)) {
    const [households, cats] = await Promise.all([
      listHouseholdsForUser(userId, d1),
      listCatsForUser(userId, d1),
    ]);
    const scope = parseMcpPermissionsInput(
      formData.get(MCP_PERMISSIONS_FIELD_NAME),
      { householdIds: households.map((household) => household.id), cats },
    );
    if (!scope) {
      return false;
    }
    Object.assign(values, scope);
  }
  if (formData.has(MCP_OPERATIONS_FIELD_NAME)) {
    const operations = parseMcpOperationsInput(
      formData.get(MCP_OPERATIONS_FIELD_NAME),
    );
    if (!operations) {
      return false;
    }
    values.allowedOperations = operations;
  }
  if (Object.keys(values).length === 0) {
    return false;
  }

  const row = { ...values, updatedAt: new Date() };
  await getDb(d1)
    .insert(mcpPermissions)
    .values({ userId, clientId, ...row })
    .onConflictDoUpdate({
      target: [mcpPermissions.userId, mcpPermissions.clientId],
      set: row,
    });
  return true;
}

/** 接続を解除したときに、その接続の範囲を消す */
export async function deleteMcpPermissions(
  userId: string,
  clientId: string,
  d1?: D1Database,
): Promise<void> {
  await getDb(d1)
    .delete(mcpPermissions)
    .where(permissionsKey(userId, clientId));
}

function permissionsKey(userId: string, clientId: string) {
  return and(
    eq(mcpPermissions.userId, userId),
    eq(mcpPermissions.clientId, clientId),
  );
}
