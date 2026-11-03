import {
  generateSessionToken,
  hashSessionToken,
} from "@/features/auth/domain/sessionToken";
import {
  type HouseholdInvitationPreview,
  householdInvitationExpiresAt,
  toHouseholdInvitationPreview,
} from "../domain/household";
import { createHouseholdInvitationRepository } from "../infrastructure/householdInvitationRepository";

/*
 * 家への招待（ユースケース）。DB にはトークンのハッシュだけを保存する
 */

export type CreateHouseholdInvitationResult =
  | { ok: true; token: string; expiresAt: Date }
  | { ok: false; error: string };

/**
 * 家への招待を発行し、URL に含めるトークンを返す。家のオーナーだけが発行できる。
 * DB にはトークンのハッシュだけを保存するため、トークン（URL）を返せるのはこのときだけ。
 * ついでに、その家の期限切れで未使用の招待を削除する
 */
export async function createHouseholdInvitation(
  householdId: string,
  ownerUserId: string,
  d1?: D1Database,
): Promise<CreateHouseholdInvitationResult> {
  const repository = createHouseholdInvitationRepository(d1);
  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = householdInvitationExpiresAt(now);

  await repository.removeExpired(householdId, now);

  const added = await repository.addAsOwner(
    householdId,
    ownerUserId,
    await hashSessionToken(token),
    expiresAt,
    now,
  );
  if (!added) {
    return { ok: false, error: "招待 URL を発行できるのはオーナーだけです" };
  }
  return { ok: true, token, expiresAt };
}

export type RevokeHouseholdInvitationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * まだ使われていない招待を無効化する（行を削除する）。家のオーナーだけが無効化でき、
 * 無効化した招待の URL を開いても家には参加できない
 */
export async function revokeHouseholdInvitation(
  householdId: string,
  ownerUserId: string,
  invitationId: string,
  d1?: D1Database,
): Promise<RevokeHouseholdInvitationResult> {
  if (
    !(await createHouseholdInvitationRepository(d1).removeAsOwner(
      householdId,
      ownerUserId,
      invitationId,
    ))
  ) {
    return {
      ok: false,
      error:
        "招待を無効化できませんでした。オーナー本人が、まだ使われていない招待を選んでください",
    };
  }
  return { ok: true };
}

/** 招待 URL を開いたユーザーに、招待された家と参加できるかどうかを返す */
export async function getHouseholdInvitationPreview(
  token: string,
  userId: string,
  d1?: D1Database,
): Promise<HouseholdInvitationPreview> {
  const invitation = await createHouseholdInvitationRepository(d1).findForUser(
    await hashSessionToken(token),
    userId,
  );
  return toHouseholdInvitationPreview(invitation, new Date());
}

export type AcceptHouseholdInvitationResult =
  | { ok: true; householdId: string }
  | { ok: false; error: string };

/**
 * 招待を使って家に参加する。1 つの招待で参加できるのは 1 人だけ。
 * 以前この招待で参加して家から抜けたユーザーが開き直しても参加し直せない。
 * すでにその家のメンバーであるユーザーが開いた場合は、使用済みにせずに失敗させる
 * （オーナーが自分で URL を試しても、招待した相手が参加できなくならないように）
 */
export async function acceptHouseholdInvitation(
  token: string,
  userId: string,
  d1?: D1Database,
): Promise<AcceptHouseholdInvitationResult> {
  const householdId = await createHouseholdInvitationRepository(d1).accept(
    await hashSessionToken(token),
    userId,
    new Date(),
  );
  if (householdId == null) {
    return {
      ok: false,
      error:
        "家に参加できませんでした。招待 URL の期限が切れているか、すでに使われています",
    };
  }
  return { ok: true, householdId };
}
