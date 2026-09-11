export type TimelineHrefParams = {
  page: number;
  ym: string;
  /** 指定すると、その日付（YYYY-MM-DD）に絞り込むリンクになる */
  date?: string;
};

export function buildTimelineHref(
  catId: string,
  params: TimelineHrefParams,
): string {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(params.page));
  searchParams.set("ym", params.ym);
  if (params.date) {
    searchParams.set("date", params.date);
  }
  return `/cats/${catId}/timeline?${searchParams.toString()}`;
}
