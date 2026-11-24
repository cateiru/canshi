import type { AccessPermissions } from "@/features/external-access/domain/permissionRules";
import {
  type ApiAccessLogContent,
  toApiAccessLogContent,
} from "../domain/apiAccessLog";
import {
  apiTokenExpiresAt,
  generateApiToken,
  hashApiToken,
} from "../domain/apiToken";
import type { ApiTokenFormInput } from "../domain/schema";
import { createApiAccessLogRepository } from "../infrastructure/apiAccessLogRepository";
import { createApiTokenRepository } from "../infrastructure/apiTokenRepository";

/*
 * API トークンの発行・変更・削除と、アクセス履歴の記録（ユースケース）
 */

/**
 * トークンを発行し、トークンを返す。DB にはハッシュだけを保存するため、トークンを返せるのはこのときだけ
 */
export async function createApiToken(
  userId: string,
  input: ApiTokenFormInput,
  permissions: AccessPermissions,
  d1?: D1Database,
): Promise<{ id: string; token: string; expiresAt: Date | null }> {
  const token = generateApiToken();
  const expiresAt = apiTokenExpiresAt(input.expiration, new Date());
  const id = await createApiTokenRepository(d1).add(userId, {
    name: input.name,
    tokenHash: await hashApiToken(token),
    expiresAt,
    permissions,
  });
  return { id, token, expiresAt };
}

/** トークンに許可する範囲を変える。次のリクエストから反映される。見つからなければ false */
export async function updateApiTokenPermissions(
  userId: string,
  id: string,
  permissions: AccessPermissions,
  d1?: D1Database,
): Promise<boolean> {
  return createApiTokenRepository(d1).updatePermissions(
    userId,
    id,
    permissions,
  );
}

/**
 * トークンと、そのアクセス履歴を削除する。削除したトークンは、次のリクエストから使えなくなる。
 * 見つからなければ false
 */
export async function deleteApiToken(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<boolean> {
  return createApiTokenRepository(d1).remove(userId, id);
}

/** API へのアクセスの履歴を残す */
export async function recordApiAccess(
  apiTokenId: string,
  access: ApiAccessLogContent,
  accessedAt: Date,
  d1?: D1Database,
): Promise<void> {
  await createApiAccessLogRepository(d1).add(
    apiTokenId,
    toApiAccessLogContent(access),
    accessedAt,
  );
}
