import { z } from "zod";
import type { TimelineRecordType } from "@/features/timeline/queries";

/**
 * AI との接続（MCP）で読み取りを許可するかを選べる記録の種類。タイムラインの記録の種類
 * から、誕生日・お迎え日（猫のプロフィールの生年月日・お迎え日から求める記念日）を
 * 除いたもの。記念日はプロフィールと同じく、猫を許可していれば読み取れる。
 *
 * クライアントのコンポーネントからも使うため、`TIMELINE_RECORD_TYPES`（DB に依存する
 * モジュール）は参照せずに並べる。過不足が無いことはテストで確かめる
 */
export const MCP_PERMISSION_RECORD_TYPES = [
  "feeding",
  "poop",
  "weight",
  "vomit",
  "water",
  "shampoo",
  "cleaning",
  "symptom",
  "medicationDose",
  "hospitalVisit",
  "expense",
] as const satisfies readonly TimelineRecordType[];

export type McpPermissionRecordType =
  (typeof MCP_PERMISSION_RECORD_TYPES)[number];

/** タイムラインのうち、記録の種類の権限にかかわらず読み取れる記念日の種類 */
export const MCP_ALWAYS_ALLOWED_TIMELINE_TYPES = [
  "birthday",
  "adoption",
] as const satisfies readonly TimelineRecordType[];

/**
 * AI との接続から読み取れる範囲。家・猫・記録の種類のうち、外したもの（拒否）だけを持ち、
 * ここに無いものはすべて読み取れる（`src/db/schema/mcp-permissions.ts` 参照）
 */
export interface McpPermissions {
  excludedHouseholdIds: string[];
  excludedCatIds: string[];
  /** 猫の ID ごとに、外した記録の種類 */
  excludedRecordTypes: Record<string, McpPermissionRecordType[]>;
}

/** 何も外していない（すべて読み取れる）状態。設定を保存していないユーザーはこれになる */
export const DEFAULT_MCP_PERMISSIONS: McpPermissions = {
  excludedHouseholdIds: [],
  excludedCatIds: [],
  excludedRecordTypes: {},
};

export function isMcpPermissionRecordType(
  value: unknown,
): value is McpPermissionRecordType {
  return (MCP_PERMISSION_RECORD_TYPES as readonly unknown[]).includes(value);
}

/**
 * 猫のプロフィールと記録を読み取れるか。家は猫が今いる家で判定するため、外した家へ
 * 引っ越した猫は読み取れなくなり、外した家から引っ越した猫は猫の設定に従う
 */
export function isCatAllowedForMcp(
  permissions: McpPermissions,
  cat: { id: string; householdId: string | null },
) {
  if (cat.householdId === null) {
    return false;
  }
  return (
    !permissions.excludedHouseholdIds.includes(cat.householdId) &&
    !permissions.excludedCatIds.includes(cat.id)
  );
}

/** 猫について読み取れる記録の種類（猫そのものを読み取れるかは `isCatAllowedForMcp` で判定する） */
export function allowedMcpRecordTypes(
  permissions: McpPermissions,
  catId: string,
): McpPermissionRecordType[] {
  const excluded = permissions.excludedRecordTypes[catId] ?? [];
  return MCP_PERMISSION_RECORD_TYPES.filter((type) => !excluded.includes(type));
}

/** 設定画面・同意画面に表示する、家ごとの猫と記録の種類のチェックの状態 */
export interface McpPermissionTreeHousehold {
  id: string;
  name: string;
  checked: boolean;
  cats: McpPermissionTreeCat[];
}

export interface McpPermissionTreeCat {
  id: string;
  name: string;
  checked: boolean;
  /** チェックが付いている記録の種類 */
  checkedRecordTypes: McpPermissionRecordType[];
}

/**
 * 保存した範囲から、画面に表示するチェックの状態を作る。親のチェックが外れているときは、
 * 子のチェックもすべて外れた状態にする
 */
export function buildMcpPermissionTree(
  permissions: McpPermissions,
  households: { id: string; name: string }[],
  cats: { id: string; name: string; householdId: string | null }[],
): McpPermissionTreeHousehold[] {
  return households.map((household) => {
    const householdChecked = !permissions.excludedHouseholdIds.includes(
      household.id,
    );
    return {
      id: household.id,
      name: household.name,
      checked: householdChecked,
      cats: cats
        .filter((cat) => cat.householdId === household.id)
        .map((cat) => {
          const catChecked =
            householdChecked && !permissions.excludedCatIds.includes(cat.id);
          return {
            id: cat.id,
            name: cat.name,
            checked: catChecked,
            checkedRecordTypes: catChecked
              ? allowedMcpRecordTypes(permissions, cat.id)
              : [],
          };
        }),
    };
  });
}

/** フォームで送る、範囲の値を入れる hidden の input の name */
export const MCP_PERMISSIONS_FIELD_NAME = "mcpPermissions";

/** 1 回に保存できる家・猫の数の上限。所属する家・猫に絞り込む前の、不正に大きな値を弾く */
const MAX_IDS = 1000;

const idSchema = z.string().min(1).max(200);

/** フォームで送る値（`McpPermissions` の JSON）の形 */
const mcpPermissionsInputSchema = z.object({
  excludedHouseholdIds: z.array(idSchema).max(MAX_IDS),
  excludedCatIds: z.array(idSchema).max(MAX_IDS),
  excludedRecordTypes: z
    .record(
      idSchema,
      z
        .array(z.enum(MCP_PERMISSION_RECORD_TYPES))
        .max(MCP_PERMISSION_RECORD_TYPES.length),
    )
    .refine((value) => Object.keys(value).length <= MAX_IDS),
});

/**
 * フォームで送られた範囲を検証し、ユーザーが所属する家・参照できる猫だけに絞り込む。
 * 形が正しくなければ null。チェックを外した家の猫・外した猫の記録の種類は、親を外せば
 * 読み取れないため保存しない
 */
export function parseMcpPermissionsInput(
  value: FormDataEntryValue | null,
  accessible: {
    householdIds: string[];
    cats: { id: string; householdId: string | null }[];
  },
): McpPermissions | null {
  if (typeof value !== "string") {
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(value);
  } catch {
    return null;
  }
  const parsed = mcpPermissionsInputSchema.safeParse(json);
  if (!parsed.success) {
    return null;
  }

  const excludedHouseholdIds = unique(
    parsed.data.excludedHouseholdIds.filter((id) =>
      accessible.householdIds.includes(id),
    ),
  );
  const catsInAllowedHouseholds = accessible.cats.filter(
    (cat) =>
      cat.householdId !== null &&
      !excludedHouseholdIds.includes(cat.householdId),
  );
  const excludedCatIds = unique(
    parsed.data.excludedCatIds.filter((id) =>
      catsInAllowedHouseholds.some((cat) => cat.id === id),
    ),
  );
  const excludedRecordTypes: McpPermissions["excludedRecordTypes"] = {};
  for (const cat of catsInAllowedHouseholds) {
    if (excludedCatIds.includes(cat.id)) {
      continue;
    }
    const types = parsed.data.excludedRecordTypes[cat.id];
    if (types && types.length > 0) {
      // 並び順を揃えて保存する
      excludedRecordTypes[cat.id] = MCP_PERMISSION_RECORD_TYPES.filter((type) =>
        types.includes(type),
      );
    }
  }
  return { excludedHouseholdIds, excludedCatIds, excludedRecordTypes };
}

function unique(values: string[]) {
  return [...new Set(values)];
}
