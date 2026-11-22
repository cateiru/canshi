/** 家の記録の出力のページ */
export function recordExportsPath(householdId: string): string {
  return `/settings/households/${householdId}/record-exports`;
}

/** 出力の状態を確かめる API（出力のページが処理中の間だけ 1 秒ごとに呼ぶ） */
export function recordExportStatusApiPath(householdId: string): string {
  return `/api/households/${encodeURIComponent(householdId)}/record-exports/status`;
}

/** 出力した zip をダウンロードする API */
export function recordExportDownloadPath(
  householdId: string,
  recordExportId: string,
): string {
  return `/api/households/${encodeURIComponent(householdId)}/record-exports/${encodeURIComponent(recordExportId)}/download`;
}
