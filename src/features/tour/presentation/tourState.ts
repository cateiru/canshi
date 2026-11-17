import { cookies } from "next/headers";
import { cache } from "react";
import { sessionCookieOptions } from "@/features/auth/domain/sessionToken";
import { getCurrentUser } from "@/features/auth/presentation/session";
import { listFeedingPresetsForUser } from "@/features/feeding-presets/infrastructure/queries";
import { listFeedingSchedulesByHouseholdIds } from "@/features/feeding-schedules/infrastructure/queries";
import { listFoodProductsForUser } from "@/features/food-products/infrastructure/queries";
import {
  listCatsForUser,
  listHouseholdsForUser,
} from "@/features/households/infrastructure/queries";
import {
  EMPTY_TOUR_PROGRESS,
  effectiveTourPosition,
  parseTourPosition,
  TOUR_COOKIE_MAX_AGE_SECONDS,
  TOUR_COOKIE_NAME,
  type TourPosition,
  type TourProgress,
  type TourView,
} from "../domain/tour";

/**
 * ガイドの Cookie の属性。ログイン（OIDC のコールバック・開発用ログイン）と Server Action で共通。
 * Secure の扱いはセッションの Cookie に合わせる
 */
export function tourCookieOptions() {
  const { httpOnly, sameSite, secure, path } = sessionCookieOptions(new Date());
  return {
    httpOnly,
    sameSite,
    secure,
    path,
    maxAge: TOUR_COOKIE_MAX_AGE_SECONDS,
  };
}

/** ユーザーが所属する家に、各ステップで登録するものがあるかを調べる */
export async function loadTourProgress(
  userId: string,
): Promise<{ householdId: string | null; progress: TourProgress }> {
  const households = await listHouseholdsForUser(userId);
  if (households.length === 0) {
    return { householdId: null, progress: EMPTY_TOUR_PROGRESS };
  }
  const [cats, foodProducts, schedules, presets] = await Promise.all([
    listCatsForUser(userId),
    listFoodProductsForUser(userId),
    listFeedingSchedulesByHouseholdIds(
      households.map((household) => household.id),
    ),
    listFeedingPresetsForUser(userId),
  ]);
  return {
    householdId: households[0].id,
    progress: {
      household: true,
      cat: cats.length > 0,
      food: foodProducts.length > 0,
      schedule: schedules.length > 0,
      preset: presets.length > 0,
    },
  };
}

/** Cookie のガイドの位置。ガイドの途中でなければ null */
export async function readTourPosition(): Promise<TourPosition | null> {
  return parseTourPosition((await cookies()).get(TOUR_COOKIE_NAME)?.value);
}

/**
 * ガイドのパネルに表示する状態。ガイドの途中でない・ログインしていないときは null。
 * ガイドの途中でなければ DB を読まない（ふだんの表示を遅くしない）
 */
export const getTourView = cache(async (): Promise<TourView | null> => {
  const position = await readTourPosition();
  if (!position) {
    return null;
  }
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  const { householdId, progress } = await loadTourProgress(user.id);
  return {
    position: effectiveTourPosition(position, progress),
    householdId,
    progress,
  };
});
