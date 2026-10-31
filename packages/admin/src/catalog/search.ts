import type { CatalogFoodProduct } from "../db/catalogFoodProducts";

/** 一覧のメーカーごとのグループ。メーカー名のない商品は `manufacturer` が null のグループにまとめる */
export type CatalogManufacturerGroup = {
  manufacturer: string | null;
  products: CatalogFoodProduct[];
};

/** 一覧の検索。`manufacturer` のグループだけを、`keywords` のすべての語を含む商品に絞る */
export type CatalogListSearch = {
  manufacturer: string | null;
  keywords: string[];
  /** 入力欄に戻す、前後の空白を除いた検索語 */
  query: string;
};

// メインアプリの `src/features/catalog-food-products/search.ts` と同じ上限
const MAX_TEXT_LENGTH = 100;
const MAX_KEYWORDS = 10;

/**
 * 一覧のクエリ（`manufacturer`・`q`）を検索にする。`manufacturer` が空のときはメーカー名のない
 * グループを指す（メーカー名は空白を除いて保存し、空なら null にするため、実在するメーカー名とは
 * 重ならない）。`manufacturer` が無いとき・検索語が空のときは検索しない
 */
export function parseCatalogListSearch(
  manufacturer: string | undefined,
  q: string | undefined,
): CatalogListSearch | null {
  if (manufacturer === undefined || q === undefined) {
    return null;
  }
  const query = q.trim().slice(0, MAX_TEXT_LENGTH);
  // 同じ語は 1 回だけ使い、上限より後ろの語は使わない
  const keywords = [...new Set(query.split(/\s+/).filter(Boolean))].slice(
    0,
    MAX_KEYWORDS,
  );
  if (keywords.length === 0) {
    return null;
  }
  return { manufacturer: manufacturer.trim() || null, keywords, query };
}

/**
 * 商品名か検索キーワードのどれかに、すべての語が部分一致するか。メインアプリの検索（SQLite の
 * LIKE）に合わせ、英字の大文字・小文字は区別しない
 */
export function matchesCatalogKeywords(
  product: CatalogFoodProduct,
  keywords: string[],
) {
  const targets = [product.name, ...product.searchKeywords].map((text) =>
    text.toLowerCase(),
  );
  return keywords.every((keyword) => {
    const lower = keyword.toLowerCase();
    return targets.some((target) => target.includes(lower));
  });
}

/** メーカーごとにまとめる。グループと商品の並びは受け取った順（メーカー名・商品名の順）のまま */
export function groupCatalogFoodProducts(
  products: CatalogFoodProduct[],
): CatalogManufacturerGroup[] {
  const groups = new Map<string | null, CatalogFoodProduct[]>();
  for (const product of products) {
    const group = groups.get(product.manufacturer);
    if (group) {
      group.push(product);
    } else {
      groups.set(product.manufacturer, [product]);
    }
  }
  return [...groups].map(([manufacturer, items]) => ({
    manufacturer,
    products: items,
  }));
}
