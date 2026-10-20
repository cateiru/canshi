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
 * AI との接続に家ごとに許可するかを選べる、ごはん商品・プリセットの操作。
 * 読み取りの範囲とは逆に、許可したものだけを行える
 */
export const MCP_HOUSEHOLD_OPERATIONS = [
  "foodProduct:read",
  "foodProduct:create",
  "foodProduct:update",
  "feedingPreset:read",
  "feedingPreset:create",
  "feedingPreset:update",
  "feedingPreset:delete",
] as const;

export type McpHouseholdOperation = (typeof MCP_HOUSEHOLD_OPERATIONS)[number];

/** 設定画面・同意画面に表示する、家ごとの操作のまとまり */
export const MCP_HOUSEHOLD_OPERATION_GROUPS: {
  label: string;
  operations: { operation: McpHouseholdOperation; label: string }[];
}[] = [
  {
    label: "ごはん商品",
    operations: [
      { operation: "foodProduct:read", label: "読む" },
      { operation: "foodProduct:create", label: "追加" },
      { operation: "foodProduct:update", label: "編集" },
    ],
  },
  {
    label: "ごはんのプリセット",
    operations: [
      { operation: "feedingPreset:read", label: "読む" },
      { operation: "feedingPreset:create", label: "追加" },
      { operation: "feedingPreset:update", label: "編集" },
      { operation: "feedingPreset:delete", label: "削除" },
    ],
  },
];

/**
 * AI との接続から読み取れる範囲と、書き込める範囲（`src/db/schema/mcp-permissions.ts` 参照）。
 *
 * - 読み取りは、家・猫・記録の種類のうち外したもの（拒否）だけを持ち、ここに無いものは
 *   すべて読み取れる
 * - 記録の書き込み（追加・編集）と、家のごはん商品・プリセットの操作は、許可したものだけを持つ
 */
export interface McpPermissions {
  excludedHouseholdIds: string[];
  excludedCatIds: string[];
  /** 猫の ID ごとに、外した記録の種類 */
  excludedRecordTypes: Record<string, McpPermissionRecordType[]>;
  /** 猫の ID ごとに、書き込み（追加・編集）を許可した記録の種類 */
  writableRecordTypes: Record<string, McpPermissionRecordType[]>;
  /** 家の ID ごとに、許可したごはん商品・プリセットの操作 */
  householdOperations: Record<string, McpHouseholdOperation[]>;
}

/**
 * 何も外していない（すべて読み取れる）が、書き込みや操作はどれも許可していない状態。
 * 設定を保存していないユーザーはこれになる
 */
export const DEFAULT_MCP_PERMISSIONS: McpPermissions = {
  excludedHouseholdIds: [],
  excludedCatIds: [],
  excludedRecordTypes: {},
  writableRecordTypes: {},
  householdOperations: {},
};

export function isMcpHouseholdOperation(
  value: unknown,
): value is McpHouseholdOperation {
  return (MCP_HOUSEHOLD_OPERATIONS as readonly unknown[]).includes(value);
}

/** 家を読み取れるか。猫と同じく、外した家は読み取れない */
export function isHouseholdAllowedForMcp(
  permissions: Pick<McpPermissions, "excludedHouseholdIds">,
  householdId: string,
) {
  return !permissions.excludedHouseholdIds.includes(householdId);
}

/** 家のごはん商品・プリセットの操作を行えるか。読み取りを許可している家に限る */
export function isHouseholdOperationAllowedForMcp(
  permissions: McpPermissions,
  householdId: string,
  operation: McpHouseholdOperation,
) {
  return (
    isHouseholdAllowedForMcp(permissions, householdId) &&
    (permissions.householdOperations[householdId] ?? []).includes(operation)
  );
}

export function isMcpPermissionRecordType(
  value: unknown,
): value is McpPermissionRecordType {
  return (MCP_PERMISSION_RECORD_TYPES as readonly unknown[]).includes(value);
}

/**
 * 猫のプロフィールと記録を読み取れるか。家は猫が今いる家で判定するため、外した家へ
 * 引っ越した猫は読み取れなくなる。家を外すと、そのときの家の猫も外したものとして
 * 保存する（`parseMcpPermissionsInput` 参照）ため、外した家から引っ越した猫も読み取れないまま
 */
export function isCatAllowedForMcp(
  permissions: Pick<McpPermissions, "excludedHouseholdIds" | "excludedCatIds">,
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
  permissions: Pick<McpPermissions, "excludedRecordTypes">,
  catId: string,
): McpPermissionRecordType[] {
  const excluded = permissions.excludedRecordTypes[catId] ?? [];
  return MCP_PERMISSION_RECORD_TYPES.filter((type) => !excluded.includes(type));
}

/**
 * 猫について書き込める（追加・編集できる）記録の種類。書き込みを許可していて、読み取りも
 * 許可している種類に限る（猫そのものを読み取れるかは `isCatAllowedForMcp` で判定する）
 */
export function writableMcpRecordTypes(
  permissions: Pick<
    McpPermissions,
    "excludedRecordTypes" | "writableRecordTypes"
  >,
  catId: string,
): McpPermissionRecordType[] {
  const writable = permissions.writableRecordTypes[catId] ?? [];
  return allowedMcpRecordTypes(permissions, catId).filter((type) =>
    writable.includes(type),
  );
}

/** 設定画面・同意画面に表示する、家ごとの猫と記録の種類のチェックの状態 */
export interface McpPermissionTreeHousehold {
  id: string;
  name: string;
  checked: boolean;
  /** 許可しているごはん商品・プリセットの操作 */
  operations: McpHouseholdOperation[];
  cats: McpPermissionTreeCat[];
}

export interface McpPermissionTreeCat {
  id: string;
  name: string;
  checked: boolean;
  /** 読み取りのチェックが付いている記録の種類 */
  checkedRecordTypes: McpPermissionRecordType[];
  /** 書き込みのチェックが付いている記録の種類 */
  writableRecordTypes: McpPermissionRecordType[];
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
      operations: householdChecked
        ? (permissions.householdOperations[household.id] ?? [])
        : [],
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
            writableRecordTypes: catChecked
              ? writableMcpRecordTypes(permissions, cat.id)
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

const recordTypesById = z
  .record(
    idSchema,
    z
      .array(z.enum(MCP_PERMISSION_RECORD_TYPES))
      .max(MCP_PERMISSION_RECORD_TYPES.length),
  )
  .refine((value) => Object.keys(value).length <= MAX_IDS);

/**
 * フォームで送る値（`McpPermissions` の JSON）の形。書き込みの範囲を選べるようにする前に
 * 開いた同意画面からは書き込みの範囲が送られないため、省略したときは何も許可しない
 */
const mcpPermissionsInputSchema = z.object({
  excludedHouseholdIds: z.array(idSchema).max(MAX_IDS),
  excludedCatIds: z.array(idSchema).max(MAX_IDS),
  excludedRecordTypes: recordTypesById,
  writableRecordTypes: recordTypesById.default({}),
  householdOperations: z
    .record(
      idSchema,
      z
        .array(z.enum(MCP_HOUSEHOLD_OPERATIONS))
        .max(MCP_HOUSEHOLD_OPERATIONS.length),
    )
    .refine((value) => Object.keys(value).length <= MAX_IDS)
    .default({}),
});

/**
 * フォームで送られた範囲を検証し、ユーザーが所属する家・参照できる猫だけに絞り込む。
 * 形が正しくなければ null。
 *
 * 外した猫は、外した家の猫でも保存する。画面では家を外すと猫のチェックも外れるため、
 * 猫が別の家へ引っ越しても、画面で見えていたとおり読み取れないままにする。
 * 外した家の猫・外した猫の記録の種類は、親を外せば読み取れないため保存しない。
 * 書き込みの範囲・家の操作は、読み取りを許可しているものだけを保存する
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
      accessible.cats.some((cat) => cat.id === id),
    ),
  );
  const excludedRecordTypes: McpPermissions["excludedRecordTypes"] = {};
  const writableRecordTypes: McpPermissions["writableRecordTypes"] = {};
  for (const cat of catsInAllowedHouseholds) {
    if (excludedCatIds.includes(cat.id)) {
      continue;
    }
    const excluded = parsed.data.excludedRecordTypes[cat.id] ?? [];
    if (excluded.length > 0) {
      // 並び順を揃えて保存する
      excludedRecordTypes[cat.id] = MCP_PERMISSION_RECORD_TYPES.filter((type) =>
        excluded.includes(type),
      );
    }
    const writable = MCP_PERMISSION_RECORD_TYPES.filter(
      (type) =>
        !excluded.includes(type) &&
        (parsed.data.writableRecordTypes[cat.id] ?? []).includes(type),
    );
    if (writable.length > 0) {
      writableRecordTypes[cat.id] = writable;
    }
  }
  const householdOperations: McpPermissions["householdOperations"] = {};
  for (const householdId of accessible.householdIds) {
    if (excludedHouseholdIds.includes(householdId)) {
      continue;
    }
    const operations = MCP_HOUSEHOLD_OPERATIONS.filter((operation) =>
      (parsed.data.householdOperations[householdId] ?? []).includes(operation),
    );
    if (operations.length > 0) {
      householdOperations[householdId] = operations;
    }
  }
  return {
    excludedHouseholdIds,
    excludedCatIds,
    excludedRecordTypes,
    writableRecordTypes,
    householdOperations,
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}
