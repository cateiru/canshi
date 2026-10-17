import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { mcpPermissions } from "@/db/schema";
import {
  listCatsForUser,
  listHouseholdsForUser,
} from "@/features/households/queries";
import {
  buildMcpPermissionTree,
  DEFAULT_MCP_PERMISSIONS,
  isMcpPermissionRecordType,
  MCP_PERMISSIONS_FIELD_NAME,
  type McpPermissions,
  type McpPermissionTreeHousehold,
  parseMcpPermissionsInput,
} from "./permissionRules";

/**
 * ユーザーの、AI との接続から読み取れる範囲。保存していなければすべて読み取れる。
 * MCP のツールはトークンに範囲を持たせず、呼ばれるたびにこれを読む。そのため設定の
 * 変更は、接続済みのアプリにもすぐに反映される
 */
export async function getMcpPermissions(
  userId: string,
  d1?: D1Database,
): Promise<McpPermissions> {
  const db = getDb(d1);
  const [row] = await db
    .select()
    .from(mcpPermissions)
    .where(eq(mcpPermissions.userId, userId))
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
  };
}

/** 設定画面・同意画面に表示する、ユーザーの家・猫・記録の種類のチェックの状態 */
export async function getMcpPermissionTree(
  userId: string,
  d1?: D1Database,
): Promise<McpPermissionTreeHousehold[]> {
  const [permissions, households, cats] = await Promise.all([
    getMcpPermissions(userId, d1),
    listHouseholdsForUser(userId, d1),
    listCatsForUser(userId, d1),
  ]);
  // 猫は登録した順に並べる（`listCatsForUser` は新しい順）
  return buildMcpPermissionTree(permissions, households, [...cats].reverse());
}

/**
 * フォーム（`McpPermissionTreeField`）で送られた範囲を保存する。設定画面と同意画面の
 * 両方から使う。ユーザーが所属する家・参照できる猫以外の ID は保存しない。
 * 送られた値の形が正しくなければ保存せずに false を返す
 */
export async function saveMcpPermissionsFromForm(
  userId: string,
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
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: mcpPermissions.userId, set: values });
  return true;
}
