import { sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { cats } from "@/db/schema";
import { getUserById } from "@/features/auth/infrastructure/users";
import {
  listCatsForUser,
  listHouseholdsForUser,
} from "@/features/households/infrastructure/queries";
import {
  type AccessPermissions,
  buildPermissionTree,
  isCatalogOperation,
  isHouseholdOperation,
  isPermissionRecordType,
  PERMISSIONS_FIELD_NAME,
  type PermissionTree,
  parsePermissionsInput,
} from "../domain/permissionRules";

/*
 * 外部接続（AI との接続・API トークン）に許可した範囲の読み書きのうち、保存先
 * （`mcp_permissions`・`api_tokens`）によらない処理
 */

/** 範囲の列を持つ行。知らない値を含みうるため、読むときは `toAccessPermissions` を通す */
type AccessPermissionsRow = {
  excludedHouseholdIds: string[];
  excludedCatIds: string[];
  excludedRecordTypes: Record<string, string[]>;
  writableRecordTypes: Record<string, string[]>;
  householdOperations: Record<string, string[]>;
  catalogOperations: string[];
};

/** 行の範囲。保存後に記録の種類・操作が無くなった場合に備えて、知らないものは読み飛ばす */
export function toAccessPermissions(
  row: AccessPermissionsRow,
): AccessPermissions {
  return {
    excludedHouseholdIds: row.excludedHouseholdIds,
    excludedCatIds: row.excludedCatIds,
    excludedRecordTypes: filterValues(
      row.excludedRecordTypes,
      isPermissionRecordType,
    ),
    writableRecordTypes: filterValues(
      row.writableRecordTypes,
      isPermissionRecordType,
    ),
    householdOperations: filterValues(
      row.householdOperations,
      isHouseholdOperation,
    ),
    catalogOperations: row.catalogOperations.filter(isCatalogOperation),
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

/**
 * 設定画面・同意画面に表示する、家・猫・記録の種類と操作のチェックの状態。
 * 共通のごはん商品の操作は、ユーザーが admin のときだけ含める
 */
export async function getPermissionTree(
  userId: string,
  permissions: AccessPermissions,
  d1?: D1Database,
): Promise<PermissionTree> {
  const [households, cats, user] = await Promise.all([
    listHouseholdsForUser(userId, d1),
    listCatsForUser(userId, d1),
    getUserById(userId, d1),
  ]);
  return {
    // 猫は登録した順に並べる（`listCatsForUser` は新しい順）
    households: buildPermissionTree(
      permissions,
      households,
      [...cats].reverse(),
    ),
    catalogOperations:
      user?.role === "admin" ? permissions.catalogOperations : null,
  };
}

/**
 * フォーム（`PermissionTreeField`）で送られた範囲を読む。ユーザーが所属する家・参照できる猫以外の
 * ID は取り除く。共通のごはん商品の操作は、ユーザーが admin のときだけ残す。
 * 送られた値の形が正しくなければ null
 */
export async function parsePermissionsFromForm(
  userId: string,
  formData: FormData,
  d1?: D1Database,
): Promise<AccessPermissions | null> {
  const [households, cats, user] = await Promise.all([
    listHouseholdsForUser(userId, d1),
    listCatsForUser(userId, d1),
    getUserById(userId, d1),
  ]);
  return parsePermissionsInput(formData.get(PERMISSIONS_FIELD_NAME), {
    householdIds: households.map((household) => household.id),
    cats,
    canUseCatalog: user?.role === "admin",
  });
}

/**
 * 書き込みを許可した記録の種類（猫の ID ごと）から、今メモリーへ移している猫のキーを外した値。
 *
 * 猫の一覧を読んでから範囲を保存するまでの間に猫がメモリーへ移されると、移したときに外した書き込みの
 * 許可を、古い一覧に基づいて保存し直してしまう（メモリーから戻すと、許可し直していない接続・トークンまで
 * 書き込めるようになる）。保存と同じ batch で、この値に更新して外す
 */
export function withoutMemorialCats(writableRecordTypes: SQLiteColumn) {
  return sql`(
    SELECT json_group_object(entry.key, json(entry.value))
    FROM json_each(${writableRecordTypes}) AS entry
    WHERE entry.key NOT IN (
      SELECT ${cats.id} FROM ${cats}
      WHERE ${cats.memorialDate} IS NOT NULL
    )
  )`;
}
