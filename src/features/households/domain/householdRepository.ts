/** 家の削除で一緒に削除した、画像を持ちうる行の ID */
export type RemovedHousehold = {
  /** 削除したごはん商品の ID（`media_assets.record_type = 'food_product'` の `record_id`） */
  foodProductIds: string[];
  /** 削除した支出記録の ID（論理削除済みのものも含む。`record_type = 'expense'` の `record_id`） */
  expenseRecordIds: string[];
};

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
   * 家を削除する。家に属する支出記録・ごはん商品・プリセット・ごはんの時間・家についての通知・
   * 招待・メンバーも同じ batch で削除する。`ownerUserId` がオーナーでない、または家に猫がいれば
   * 何も削除せずに null。削除できたら、画像を消すために、一緒に削除したごはん商品・支出記録の ID を返す
   * （画像は R2 にあり batch に含められないため、ここでは削除しない）
   */
  removeAsOwner(
    householdId: string,
    ownerUserId: string,
  ): Promise<RemovedHousehold | null>;
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
