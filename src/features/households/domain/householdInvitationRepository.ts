import type { HouseholdInvitationLookup } from "./household";

/**
 * 家への招待の保存先。トークンはハッシュ（`tokenHash`）だけを保存する。
 * 実装は `../infrastructure/householdInvitationRepository.ts`
 */
export interface HouseholdInvitationRepository {
  /** 家の、期限切れで未使用の招待を削除する */
  removeExpired(householdId: string, now: Date): Promise<void>;
  /** 招待を追加する。`ownerUserId` がオーナーでなければ追加せずに false */
  addAsOwner(
    householdId: string,
    ownerUserId: string,
    tokenHash: string,
    expiresAt: Date,
    now: Date,
  ): Promise<boolean>;
  /** まだ使われていない招待を削除する。`ownerUserId` がオーナーでない・見つからなければ false */
  removeAsOwner(
    householdId: string,
    ownerUserId: string,
    invitationId: string,
  ): Promise<boolean>;
  /** 招待 URL を開いたユーザーに見せる項目を読む。見つからなければ null */
  findForUser(
    tokenHash: string,
    userId: string,
  ): Promise<HouseholdInvitationLookup | null>;
  /**
   * 招待を使用済みにし、ユーザーを家のメンバーに加える。同じ batch で行い、未使用・期限内で、
   * ユーザーがまだメンバーでないときだけ通る。通れば家の ID を、通らなければ null を返す
   */
  accept(tokenHash: string, userId: string, now: Date): Promise<string | null>;
}
