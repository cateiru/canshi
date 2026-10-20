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
  isMcpHouseholdOperation,
  isMcpPermissionRecordType,
  MCP_PERMISSIONS_FIELD_NAME,
  type McpPermissions,
  type McpPermissionTreeHousehold,
  parseMcpPermissionsInput,
} from "./permissionRules";

/**
 * ユーザーが許可した接続（OAuth のクライアント）の、AI から読み取れる範囲と書き込める範囲。
 * 保存していなければすべて読み取れるが、書き込みや操作はどれも行えない。MCP のツールは
 * トークンに範囲を持たせず、呼ばれるたびにこれを読む。そのため設定の変更は、接続済みの
 * アプリにもすぐに反映される
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
  // 保存後に記録の種類・操作が無くなった場合に備えて、知らないものは読み飛ばす
  return {
    excludedHouseholdIds: row.excludedHouseholdIds,
    excludedCatIds: row.excludedCatIds,
    excludedRecordTypes: filterValues(
      row.excludedRecordTypes,
      isMcpPermissionRecordType,
    ),
    writableRecordTypes: filterValues(
      row.writableRecordTypes,
      isMcpPermissionRecordType,
    ),
    householdOperations: filterValues(
      row.householdOperations,
      isMcpHouseholdOperation,
    ),
  };
}

function filterValues<T extends string>(
  record: Record<string, string[]>,
  isKnown: (value: unknown) => value is T,
): Record<string, T[]> {
  const filtered: Record<string, T[]> = {};
  for (const [key, values] of Object.entries(record)) {
    filtered[key] = values.filter(isKnown);
  }
  return filtered;
}

/** 設定画面・同意画面に表示する、接続の家・猫・記録の種類と操作のチェックの状態 */
export async function getMcpPermissionTree(
  userId: string,
  clientId: string,
  d1?: D1Database,
): Promise<McpPermissionTreeHousehold[]> {
  const [permissions, households, cats] = await Promise.all([
    getMcpPermissions(userId, clientId, d1),
    listHouseholdsForUser(userId, d1),
    listCatsForUser(userId, d1),
  ]);
  // 猫は登録した順に並べる（`listCatsForUser` は新しい順）
  return buildMcpPermissionTree(permissions, households, [...cats].reverse());
}

/**
 * フォーム（`McpPermissionTreeField`）で送られた範囲を、接続の範囲として保存する。
 * 設定画面と同意画面の両方から使う。ユーザーが所属する家・参照できる猫以外の ID は
 * 保存しない。送られた値の形が正しくなければ保存せずに false を返す
 */
export async function saveMcpPermissionsFromForm(
  userId: string,
  clientId: string,
  formData: FormData,
  d1?: D1Database,
): Promise<boolean> {
  const [households, cats] = await Promise.all([
    listHouseholdsForUser(userId, d1),
    listCatsForUser(userId, d1),
  ]);
  const permissions = parseMcpPermissionsInput(
    formData.get(MCP_PERMISSIONS_FIELD_NAME),
    { householdIds: households.map((household) => household.id), cats },
  );
  if (!permissions) {
    return false;
  }

  const db = getDb(d1);
  const values = { ...permissions, updatedAt: new Date() };
  await db
    .insert(mcpPermissions)
    .values({ userId, clientId, ...values })
    .onConflictDoUpdate({
      target: [mcpPermissions.userId, mcpPermissions.clientId],
      set: values,
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
