import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { mcpPermissions } from "@/db/schema";
import {
  type AccessPermissions,
  DEFAULT_PERMISSIONS,
  type PermissionTree,
} from "@/features/external-access/domain/permissionRules";
import {
  getPermissionTree,
  parsePermissionsFromForm,
  toAccessPermissions,
  withoutMemorialCats,
} from "@/features/external-access/infrastructure/permissions";

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
): Promise<AccessPermissions> {
  const db = getDb(d1);
  const [row] = await db
    .select()
    .from(mcpPermissions)
    .where(permissionsKey(userId, clientId))
    .limit(1);
  return row ? toAccessPermissions(row) : DEFAULT_PERMISSIONS;
}

/**
 * 設定画面・同意画面に表示する、接続の家・猫・記録の種類と操作のチェックの状態。
 * 共通のごはん商品の操作は、ユーザーが admin のときだけ含める
 */
export async function getMcpPermissionTree(
  userId: string,
  clientId: string,
  d1?: D1Database,
): Promise<PermissionTree> {
  return getPermissionTree(
    userId,
    await getMcpPermissions(userId, clientId, d1),
    d1,
  );
}

/**
 * フォーム（`PermissionTreeField`）で送られた範囲を、接続の範囲として保存する。
 * 設定画面と同意画面の両方から使う。ユーザーが所属する家・参照できる猫以外の ID は
 * 保存しない。共通のごはん商品の操作は、ユーザーが admin のときだけ保存する。
 * 送られた値の形が正しくなければ保存せずに false を返す
 */
export async function saveMcpPermissionsFromForm(
  userId: string,
  clientId: string,
  formData: FormData,
  d1?: D1Database,
): Promise<boolean> {
  const permissions = await parsePermissionsFromForm(userId, formData, d1);
  if (!permissions) {
    return false;
  }

  const db = getDb(d1);
  const values = { ...permissions, updatedAt: new Date() };
  await db.batch([
    db
      .insert(mcpPermissions)
      .values({ userId, clientId, ...values })
      .onConflictDoUpdate({
        target: [mcpPermissions.userId, mcpPermissions.clientId],
        set: values,
      }),
    // その時点でメモリーへ移している猫のキーを外す（`withoutMemorialCats` 参照）
    db
      .update(mcpPermissions)
      .set({
        writableRecordTypes: withoutMemorialCats(
          mcpPermissions.writableRecordTypes,
        ),
      })
      .where(permissionsKey(userId, clientId)),
  ]);
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
