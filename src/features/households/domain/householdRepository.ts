/**
 * 家とメンバーの保存先。オーナーにだけ許す操作は、オーナーであることを同じ文の中で確かめる
 * （読んでから書く方式だと、判定と更新の間にオーナーを移譲された場合に元オーナーの操作が通ってしまうため）。
 * 実装は `../infrastructure/householdRepository.ts`
 */
export interface HouseholdRepository {
  /** 家を作り、作ったユーザーをオーナーにする。家とメンバーは同じ batch で追加する */
  addWithOwner(ownerUserId: string, name: string): Promise<string>;
  /** 家の名前を変える。`ownerUserId` がオーナーでなければ false */
  renameAsOwner(
    householdId: string,
    ownerUserId: string,
    name: string,
  ): Promise<boolean>;
  /** オーナー以外のメンバーを外す。`ownerUserId` がオーナーでない・外せるメンバーでなければ false */
  removeMemberAsOwner(
    householdId: string,
    ownerUserId: string,
    memberUserId: string,
  ): Promise<boolean>;
  /** オーナー以外のメンバーが自分で抜ける。オーナー・メンバーでなければ false */
  removeSelfAsMember(householdId: string, userId: string): Promise<boolean>;
  /**
   * オーナーを移譲する。移譲先をオーナーに、移譲元をメンバーにする。2 人のロールの入れ替えと
   * 条件の判定を 1 つの文にまとめる。移譲元がオーナーで移譲先がメンバーでなければ false
   */
  transferOwnership(
    householdId: string,
    currentOwnerUserId: string,
    nextOwnerUserId: string,
  ): Promise<boolean>;
}
