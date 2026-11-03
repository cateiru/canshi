/** ユーザーと、そのユーザーが参照できる猫（所属する家の猫）の組 */
export type UserCatAccess = { userId: string; catId: string };

/** ユーザーと、そのユーザーが所属する家の組 */
export type UserHouseholdAccess = { userId: string; householdId: string };

/** ユーザー ID ごとの、参照できる猫・所属する家の ID の集合 */
export type PushAccessIndex = {
  catIdsByUser: ReadonlyMap<string, ReadonlySet<string>>;
  householdIdsByUser: ReadonlyMap<string, ReadonlySet<string>>;
};

function groupByUser<T extends { userId: string }>(
  accesses: readonly T[],
  idOf: (access: T) => string,
): Map<string, Set<string>> {
  const idsByUser = new Map<string, Set<string>>();
  for (const access of accesses) {
    const ids = idsByUser.get(access.userId) ?? new Set<string>();
    ids.add(idOf(access));
    idsByUser.set(access.userId, ids);
  }
  return idsByUser;
}

/** ユーザー ID ごとに、参照できる猫・所属する家の ID の集合にまとめる */
export function buildPushAccessIndex(
  catAccesses: readonly UserCatAccess[],
  householdAccesses: readonly UserHouseholdAccess[],
): PushAccessIndex {
  return {
    catIdsByUser: groupByUser(catAccesses, (access) => access.catId),
    householdIdsByUser: groupByUser(
      householdAccesses,
      (access) => access.householdId,
    ),
  };
}

/**
 * 通知を送る購読を返す。猫についての通知はその猫を参照できるユーザー（猫の家のメンバー）、
 * 家についての通知はその家のメンバー、ユーザーについての通知はそのユーザー本人の購読だけを
 * 対象にし、ユーザーに紐付いていない購読（ユーザーの導入前のもの）には送らない
 */
export function selectPushTargets<T extends { userId: string | null }>(
  notification: {
    catId: string | null;
    householdId: string | null;
    userId: string | null;
  },
  subscriptions: readonly T[],
  { catIdsByUser, householdIdsByUser }: PushAccessIndex,
): T[] {
  return subscriptions.filter((subscription) => {
    if (subscription.userId == null) {
      return false;
    }
    if (notification.catId != null) {
      return (
        catIdsByUser.get(subscription.userId)?.has(notification.catId) ?? false
      );
    }
    if (notification.householdId != null) {
      return (
        householdIdsByUser
          .get(subscription.userId)
          ?.has(notification.householdId) ?? false
      );
    }
    if (notification.userId != null) {
      return subscription.userId === notification.userId;
    }
    return false;
  });
}
