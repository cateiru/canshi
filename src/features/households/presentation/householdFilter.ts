import type { BreadcrumbItem } from "@/components/ui";

type HouseholdLike = { id: string; name: string };

/**
 * 一覧ページの `householdId` クエリで絞り込む家を返す。未指定や、所属していない家の ID が
 * 指定された場合は null を返す（このときは所属しているすべての家の一覧を表示する）
 */
export function findFilterHousehold<H extends HouseholdLike>(
  households: readonly H[],
  householdId: string | string[] | undefined,
): H | null {
  if (typeof householdId !== "string") {
    return null;
  }
  return households.find((household) => household.id === householdId) ?? null;
}

/**
 * 家の詳細設定から開いた一覧ページのパンくず（トップ > 設定 > 家の設定 > 家の名前 > 一覧）。
 * 一覧の下の登録ページなどで使うときは、一覧へ戻れるよう `href` を渡す
 */
export function householdSettingsBreadcrumbItems(
  household: HouseholdLike,
  label: string,
  href?: string,
): BreadcrumbItem[] {
  return [
    { label: "トップ", href: "/home" },
    { label: "設定", href: "/settings" },
    { label: "家の設定", href: "/settings/households" },
    {
      label: household.name,
      href: `/settings/households/${encodeURIComponent(household.id)}`,
    },
    href ? { label, href } : { label },
  ];
}
