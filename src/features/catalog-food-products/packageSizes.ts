import type { CatalogFoodProduct, CatalogPackageSize } from "@/db/schema";
import { formatPackageAmount } from "@/features/food-products/labels";

/**
 * 共通のごはん商品の内容量の候補。先頭の候補は `packageAmountG`・`packageUnit` から取り、
 * `packageSizes` からは 2 件目以降だけを使う。
 * 今の管理画面は先頭の候補を両方に同じ値で書くが、`0050` を適用してから管理画面を
 * デプロイするまでの間は、候補を知らない古い管理画面が `packageAmountG`・`packageUnit` だけを
 * 登録・更新する（`packageSizes` は空か、埋めたときの値のまま残る）。その更新も反映するため
 */
export function catalogPackageSizes(
  product: Pick<
    CatalogFoodProduct,
    "packageSizes" | "packageAmountG" | "packageUnit"
  >,
): CatalogPackageSize[] {
  const first = { amountG: product.packageAmountG, unit: product.packageUnit };
  return [
    first,
    ...product.packageSizes
      .slice(1)
      .filter(
        (size) => size.amountG !== first.amountG || size.unit !== first.unit,
      ),
  ];
}

/** 内容量の候補の表示用文字列（家のごはん商品と同じく「14g/本」「1500g」） */
export function formatPackageSize(size: CatalogPackageSize): string {
  return formatPackageAmount({
    packageAmountG: size.amountG,
    packageUnit: size.unit,
  });
}

/**
 * 内容量の候補を、追加フォームで送る値にする。追加するときは、送られた値がその時点の候補に
 * あるかを確かめる（候補の位置で選ばせると、画面を開いてから管理画面で候補が編集されたときに
 * 別の内容量が追加されるため）
 */
export function toPackageSizeValue(size: CatalogPackageSize): string {
  return JSON.stringify([size.amountG, size.unit]);
}

/** `toPackageSizeValue` で作った値を読む。形が違えば null */
export function parsePackageSizeValue(
  value: FormDataEntryValue | null,
): CatalogPackageSize | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "number" &&
      Number.isFinite(parsed[0]) &&
      parsed[0] > 0 &&
      (typeof parsed[1] === "string" || parsed[1] === null)
    ) {
      return { amountG: parsed[0], unit: parsed[1] };
    }
  } catch {
    // 下で null を返す
  }
  return null;
}
