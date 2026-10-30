import { eq, inArray, or } from "drizzle-orm";
import type { getDb } from "@/db/client";
import { notifications } from "@/db/schema";
import {
  accessibleCatIdsQuery,
  accessibleHouseholdIdsQuery,
} from "@/features/households/queries";

/**
 * ユーザーが参照できる通知に一致する条件。猫についての通知はユーザーの家の猫の通知、
 * 家についての通知はユーザーが所属する家の通知、ユーザーについての通知はユーザー本人宛ての
 * 通知に限る。別の家・別のユーザーの通知は、存在しない通知と同じく一覧・更新の対象にしない。
 * バインドパラメーターとして userId を 3 個使う
 */
export function accessibleNotificationsCondition(
  db: ReturnType<typeof getDb>,
  userId: string,
) {
  return or(
    inArray(notifications.catId, accessibleCatIdsQuery(db, userId)),
    inArray(notifications.householdId, accessibleHouseholdIdsQuery(db, userId)),
    eq(notifications.userId, userId),
  );
}
