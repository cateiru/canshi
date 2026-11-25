/** 家のメモのラベルを管理するページ */
export function memoLabelsPath(householdId: string): string {
  return `/settings/households/${householdId}/memo-labels`;
}

/** 猫のメモの一覧。`labelId` を渡すと、そのラベルが付いたメモに絞り込む */
export function memoRecordsHref(
  catId: string,
  { labelId, page = 1 }: { labelId?: string; page?: number } = {},
): string {
  const searchParams = new URLSearchParams();
  if (labelId) {
    searchParams.set("label", labelId);
  }
  if (page > 1) {
    searchParams.set("page", String(page));
  }
  const query = searchParams.toString();
  return `/cats/${catId}/memo-records${query ? `?${query}` : ""}`;
}
