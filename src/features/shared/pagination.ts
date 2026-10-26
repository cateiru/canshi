/** 記録一覧の1ページあたりの表示件数 */
export const RECORD_PAGE_SIZE = 50;

// URL の page パラメータとして受け付ける上限。極端な値（巨大な数値など）を
// そのままリンク生成や計算に使わないようにする
const MAX_PAGE = 100_000;

/**
 * URL の page パラメータを 1 以上の整数に丸める。未指定・不正値は 1 ページ目として扱う。
 * 配列（`?page=1&page=2`）が渡された場合は先頭の値を使う。
 */
export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(parsed, MAX_PAGE);
}

export type Paginated<T> = {
  items: T[];
  /** 実際に表示するページ（総ページ数を超えるページが指定された場合は最終ページに丸める） */
  page: number;
  /** 総ページ数（記録が0件でも 1） */
  totalPages: number;
};

/** 新しい順などに並べ済みの配列から、指定ページの分だけを切り出す */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number = RECORD_PAGE_SIZE,
): Paginated<T> {
  const totalPages = Math.max(Math.ceil(items.length / pageSize), 1);
  const currentPage = Math.min(Math.max(Math.trunc(page), 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: currentPage,
    totalPages,
  };
}

/** 一覧ページの指定ページへのリンクを作る。1ページ目は page パラメータを付けない */
export function buildPageHref(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?page=${page}`;
}
