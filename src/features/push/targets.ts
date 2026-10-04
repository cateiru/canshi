/** ユーザーと、そのユーザーが参照できる猫（所属する家の猫）の組 */
export type UserCatAccess = { userId: string; catId: string };

/** ユーザー ID ごとに、参照できる猫の ID の集合にまとめる */
export function groupCatIdsByUser(
  accesses: readonly UserCatAccess[],
): Map<string, Set<string>> {
  const catIdsByUser = new Map<string, Set<string>>();
  for (const { userId, catId } of accesses) {
    const catIds = catIdsByUser.get(userId) ?? new Set<string>();
    catIds.add(catId);
    catIdsByUser.set(userId, catIds);
  }
  return catIdsByUser;
}

/**
 * 通知を送る購読を返す。通知の猫を参照できるユーザー（猫の家のメンバー）の購読だけを対象にし、
 * ユーザーに紐付いていない購読（ユーザーの導入前のもの）には送らない
 */
export function selectPushTargets<T extends { userId: string | null }>(
  notification: { catId: string },
  subscriptions: readonly T[],
  catIdsByUser: ReadonlyMap<string, ReadonlySet<string>>,
): T[] {
  return subscriptions.filter(
    (subscription) =>
      subscription.userId != null &&
      (catIdsByUser.get(subscription.userId)?.has(notification.catId) ?? false),
  );
}
