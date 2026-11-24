import type { Cat, RecordActor } from "@/db/schema";
import { isMemorialCat } from "@/features/cats/domain/memorial";
import {
  getCatForUser,
  listHouseholdsForUser,
} from "@/features/households/infrastructure/queries";
import {
  type AccessPermissions,
  allowedWriteRecordTypes,
  type CatalogOperation,
  type HouseholdOperation,
  isCatAllowed,
  isHouseholdAllowed,
  isHouseholdOperationAllowed,
  type PermissionRecordType,
} from "../../domain/permissionRules";
import {
  conflictError,
  forbiddenError,
  notFoundError,
  type OperationError,
} from "./registry";

/** 操作を呼んだユーザーと、接続・トークンに許可した範囲 */
export interface OperationAccess {
  userId: string;
  /** 記録を操作した人として残す、ユーザーと接続・トークン */
  actor: RecordActor;
  permissions: AccessPermissions;
}

/** 操作を呼んだもの（AI との接続・API トークン）の呼び方。メッセージに使う */
export interface OperationCaller {
  /** 「この接続」のような、呼んだものの名前 */
  name: string;
  /** 許可する範囲を変える、設定の場所 */
  settings: string;
  /** 許可していない操作をしようとしたときに添える、許可する方法の案内 */
  howToAllow: string;
}

/**
 * 操作の実装に渡す環境。MCP は Next.js（OpenNext）の外で動くため、D1・R2 は
 * `getCloudflareContext()` ではなく `env` から明示的に渡す
 */
export interface OperationContext {
  env: Pick<Env, "DB" | "MEDIA_BUCKET">;
  /**
   * アプリを公開しているオリジン（`https://canshi.example.com` など）。
   * 招待 URL のように、アプリの URL を返すときに使う
   */
  origin: string;
  caller: OperationCaller;
  /**
   * 操作を呼んだユーザーと範囲を求める。求められなければ、操作の結果として返すエラー。
   * 操作ごとに呼び、範囲は毎回読み直す（設定の変更がすぐに反映されるようにするため）
   */
  resolveAccess(): Promise<OperationAccess | { error: OperationError }>;
}

/** 許可していない操作をしようとしたときのエラーに使う、操作の名前 */
const OPERATION_LABEL: Record<HouseholdOperation | CatalogOperation, string> = {
  "foodProduct:read": "ごはん商品の読み取り",
  "foodProduct:create": "ごはん商品の追加",
  "foodProduct:update": "ごはん商品の編集",
  "feedingPreset:read": "ごはんのプリセットの読み取り",
  "feedingPreset:create": "ごはんのプリセットの追加",
  "feedingPreset:update": "ごはんのプリセットの編集",
  "feedingPreset:delete": "ごはんのプリセットの削除",
  "household:update": "家の名前の編集",
  "householdMember:read": "家のメンバーの読み取り",
  "householdMember:update": "家のメンバーの編集",
  "householdInvitation:read": "家への招待の読み取り",
  "householdInvitation:create": "家への招待の発行",
  "householdInvitation:delete": "家への招待の無効化",
  "cat:create": "猫の追加",
  "cat:update": "猫のプロフィールの編集",
  "catNotification:read": "猫の通知の設定の読み取り",
  "catNotification:update": "猫の通知の設定の編集",
  "feedingSchedule:read": "ごはんの時間の読み取り",
  "feedingSchedule:create": "ごはんの時間の追加",
  "feedingSchedule:update": "ごはんの時間の編集",
  "feedingSchedule:delete": "ごはんの時間の削除",
  "catalogFoodProduct:read": "共通のごはん商品の読み取り",
  "catalogFoodProduct:create": "共通のごはん商品の追加",
  "catalogFoodProduct:update": "共通のごはん商品の編集",
  "catalogFoodProductRequest:read": "共通のごはん商品のリクエストの読み取り",
  "catalogFoodProductRequest:complete": "共通のごはん商品のリクエストの完了",
};

export function operationNotAllowedError(
  caller: OperationCaller,
  operation: HouseholdOperation | CatalogOperation,
  householdName?: string,
): OperationError {
  const target = householdName ? `家「${householdName}」での` : "";
  return forbiddenError(
    `${caller.name}には${target}「${OPERATION_LABEL[operation]}」が許可されていません。` +
      caller.howToAllow,
  );
}

export function catNotFoundError(catId: string): OperationError {
  return notFoundError(`catId="${catId}" の猫が見つかりません`);
}

/** メモリーへ移した猫の記録・プロフィール・通知の設定を変えようとしたときのエラー */
function memorialCatError(
  cat: Pick<Cat, "name" | "memorialDate">,
): OperationError {
  return conflictError(
    `「${cat.name}」はメモリー（思い出）に移されているため、記録・プロフィール・通知の設定は変更できません` +
      `（メモリーへ移した日: ${cat.memorialDate}）。読み取りはこれまでどおりできます`,
  );
}

/** 猫について行う操作のうち、メモリーへ移した猫には行えない（書き換える）操作 */
const MEMORIAL_BLOCKED_CAT_OPERATIONS: readonly HouseholdOperation[] = [
  "cat:update",
  "catNotification:update",
];

type CatAccess = OperationAccess & { cat: Cat & { householdId: string } };

/**
 * 記録を書き込む猫を求める。ユーザーが参照でき、読み取りを許可している猫で、
 * メモリーへ移しておらず、その記録の種類の書き込みも許可しているときに限る。読み取りを許可していない猫は、
 * 存在しない猫と区別しない
 */
export async function resolveWritableCat(
  ctx: OperationContext,
  catId: string,
  recordType: PermissionRecordType,
  recordLabel: string,
): Promise<CatAccess | { error: OperationError }> {
  const resolved = await ctx.resolveAccess();
  if ("error" in resolved) {
    return resolved;
  }
  const cat = await getCatForUser(resolved.userId, catId, ctx.env.DB);
  if (
    !cat ||
    cat.householdId === null ||
    !isCatAllowed(resolved.permissions, cat)
  ) {
    return { error: catNotFoundError(catId) };
  }
  if (isMemorialCat(cat)) {
    return { error: memorialCatError(cat) };
  }
  if (
    !allowedWriteRecordTypes(resolved.permissions, cat.id).includes(recordType)
  ) {
    return {
      error: forbiddenError(
        `${ctx.caller.name}には、この猫の${recordLabel}の書き込みが許可されていません。` +
          ctx.caller.howToAllow,
      ),
    };
  }
  return { ...resolved, cat: { ...cat, householdId: cat.householdId } };
}

export function householdNotFoundError(householdId: string): OperationError {
  return notFoundError(`householdId="${householdId}" の家が見つかりません`);
}

/**
 * ユーザーが所属し、読み取りも許可している家の一覧。
 * 家ごとの操作は、この家でだけ行える
 */
export async function listAllowedHouseholds(
  ctx: OperationContext,
  userId: string,
  permissions: AccessPermissions,
) {
  const households = await listHouseholdsForUser(userId, ctx.env.DB);
  return households.filter((household) =>
    isHouseholdAllowed(permissions, household.id),
  );
}

/**
 * 家で操作を行えるかを確かめ、行えなければ結果として返すエラーを返す。ユーザーが所属し、
 * 読み取りを許可している家で、その操作も許可しているときに限る。
 * 読み取りを許可していない家は、存在しない家と区別しない
 */
export async function checkHouseholdOperation(
  ctx: OperationContext,
  resolved: Pick<OperationAccess, "userId" | "permissions">,
  householdId: string,
  operation: HouseholdOperation,
): Promise<OperationError | null> {
  const households = await listAllowedHouseholds(
    ctx,
    resolved.userId,
    resolved.permissions,
  );
  const household = households.find(({ id }) => id === householdId);
  if (!household) {
    return householdNotFoundError(householdId);
  }
  if (
    !isHouseholdOperationAllowed(resolved.permissions, householdId, operation)
  ) {
    return operationNotAllowedError(ctx.caller, operation, household.name);
  }
  return null;
}

/** 家で操作を行えるときだけ、ユーザーと範囲を返す（`checkHouseholdOperation` 参照） */
export async function resolveHouseholdOperation(
  ctx: OperationContext,
  householdId: string,
  operation: HouseholdOperation,
): Promise<OperationAccess | { error: OperationError }> {
  const resolved = await ctx.resolveAccess();
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
 * 猫について家ごとの操作（猫のプロフィール・通知の設定）を行えるときだけ、ユーザーと範囲、猫を返す。
 * ユーザーが参照でき、読み取りも許可している猫で、猫の今の家でその操作も
 * 許可しているときに限る。メモリーへ移した猫には、書き換える操作（プロフィール・通知の設定の変更）を
 * 行えない。読み取りを許可していない猫は、存在しない猫と区別しない
 */
export async function resolveCatOperation(
  ctx: OperationContext,
  catId: string,
  operation: HouseholdOperation,
): Promise<CatAccess | { error: OperationError }> {
  const resolved = await ctx.resolveAccess();
  if ("error" in resolved) {
    return resolved;
  }
  const cat = await getCatForUser(resolved.userId, catId, ctx.env.DB);
  if (
    !cat ||
    cat.householdId === null ||
    !isCatAllowed(resolved.permissions, cat)
  ) {
    return { error: catNotFoundError(catId) };
  }
  const error = await checkHouseholdOperation(
    ctx,
    resolved,
    cat.householdId,
    operation,
  );
  if (error) {
    return { error };
  }
  if (
    isMemorialCat(cat) &&
    MEMORIAL_BLOCKED_CAT_OPERATIONS.includes(operation)
  ) {
    return { error: memorialCatError(cat) };
  }
  return { ...resolved, cat: { ...cat, householdId: cat.householdId } };
}

/**
 * 一覧の操作で、読み取りの操作を許可している家の ID を求める。`householdId` を指定したときは
 * その家だけにする。どの家でも許可していなければ、結果として返すエラー
 */
export async function resolveHouseholdIdsForOperation(
  ctx: OperationContext,
  operation: HouseholdOperation,
  householdId: string | undefined,
): Promise<{ householdIds: string[] } | { error: OperationError }> {
  const resolved = await ctx.resolveAccess();
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
    resolved.userId,
    resolved.permissions,
  );
  const householdIds = households
    .map(({ id }) => id)
    .filter((id) =>
      isHouseholdOperationAllowed(resolved.permissions, id, operation),
    );
  if (householdIds.length === 0) {
    return { error: operationNotAllowedError(ctx.caller, operation) };
  }
  return { householdIds };
}
