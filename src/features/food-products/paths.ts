import type { BreadcrumbItem } from "@/components/ui";
import { householdSettingsBreadcrumbItems } from "@/features/households/householdFilter";

type HouseholdLike = { id: string; name: string };

/** ごはん商品の各ページの URL に、家の指定（`householdId`）を引き継いで付ける */
export function withHouseholdId(path: string, household: HouseholdLike | null) {
  return household
    ? `${path}?householdId=${encodeURIComponent(household.id)}`
    : path;
}

/**
 * ごはん商品一覧の下のページ（登録・検索など）のパンくずのうち、一覧までの部分。
 * 家の詳細設定から来たときは、家の設定をたどってその家の商品一覧へ戻れるようにする
 */
export function foodProductsBreadcrumbItems(
  household: HouseholdLike | null,
): BreadcrumbItem[] {
  return household
    ? householdSettingsBreadcrumbItems(
        household,
        "ごはん商品一覧",
        withHouseholdId("/food-products", household),
      )
    : [
        { label: "トップ", href: "/home" },
        { label: "設定", href: "/settings" },
        { label: "ごはん商品一覧", href: "/food-products" },
      ];
}
