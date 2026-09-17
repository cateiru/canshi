import type { CleaningTarget } from "@/db/schema";
import { listCleaningTargets } from "@/features/cleaning/targetQueries";
import { getResolvedSettingsForCat } from "./queries";
import type { ResolvedNotificationSettings } from "./rules";

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

/**
 * タイムゾーンの選択肢。Workers ランタイム（workerd）は IANA タイムゾーンデータベースを
 * 内蔵しているため `Intl.supportedValuesOf` がそのまま使える。
 * ただし "UTC" はレガシーな別名扱いで `supportedValuesOf` の一覧には含まれない
 * （`Intl.DateTimeFormat` へは常に指定できる）。端末のタイムゾーンが UTC の場合に
 * 選択肢が見つからず表示が崩れるため、明示的に先頭へ追加する
 */
export function listTimezoneOptions(): { value: string; label: string }[] {
  return ["UTC", ...Intl.supportedValuesOf("timeZone")].map((timeZone) => ({
    value: timeZone,
    label: timeZone,
  }));
}
