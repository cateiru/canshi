/**
 * ごはんプリセットについて説明するヘルプページの URL。
 * 家の ID を渡すと、ヘルプページからその家のプリセットの登録・一覧へ進めるようにする
 */
export function feedingPresetHelpHref(householdId?: string): string {
  return householdId
    ? `/help/feeding-presets?householdId=${encodeURIComponent(householdId)}`
    : "/help/feeding-presets";
}
