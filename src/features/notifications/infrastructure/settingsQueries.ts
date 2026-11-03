import type { CleaningTarget } from "@/db/schema";
import { listCleaningTargets } from "@/features/cleaning/infrastructure/targetQueries";
import type { ResolvedNotificationSettings } from "../domain/rules";
import { getResolvedSettingsForCat } from "./queries";

export type CatNotificationSettingsPageData = {
  settings: ResolvedNotificationSettings;
  cleaningTargets: CleaningTarget[];
};

/** 猫ごとの通知設定ページ（`src/app/cats/[catId]/notification-settings/`）が使う表示用データ */
export async function getCatNotificationSettingsPageData(
  catId: string,
): Promise<CatNotificationSettingsPageData> {
  const cleaningTargets = await listCleaningTargets(catId);
  const settings = await getResolvedSettingsForCat(
    catId,
    cleaningTargets.map((target) => target.id),
  );
  return { settings, cleaningTargets };
}
