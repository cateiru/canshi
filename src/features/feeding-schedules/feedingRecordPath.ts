/**
 * 家についてのごはんの通知の遷移先。通知には猫の URL ではなくこの家の URL を保存し、開いたときに
 * その時点の家の猫から記録画面を決める（`resolveHouseholdFeedingRecordPath`）。通知を作った後に
 * 猫が引っ越し・削除されても、通知のリンクが別の家の猫や存在しない猫を指したままにならない
 */
export function householdFeedingRecordPath(householdId: string) {
  return `/households/${householdId}/feeding-records/new`;
}

/**
 * 家の猫のうち、ユーザーが参照できる猫の ID から遷移先を決める。1 匹だけならその猫のごはん記録の
 * 追加画面、いないか複数いれば記録する猫を選べる猫一覧にする
 */
export function resolveHouseholdFeedingRecordPath(catIds: readonly string[]) {
  return catIds.length === 1
    ? `/cats/${catIds[0]}/feeding-records/new`
    : "/cats";
}
