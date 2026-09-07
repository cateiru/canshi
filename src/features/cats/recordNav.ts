export type RecordNavItem = {
  href: (catId: string) => string;
  label: string;
};

/**
 * 猫詳細ページに表示する記録機能への導線。各記録機能の PR で追記する。
 */
export const RECORD_NAV_ITEMS: RecordNavItem[] = [
  { href: (catId) => `/cats/${catId}/feeding-records`, label: "給餌記録" },
  { href: (catId) => `/cats/${catId}/poop-records`, label: "うんち記録" },
  { href: (catId) => `/cats/${catId}/weight-records`, label: "体重記録" },
  { href: (catId) => `/cats/${catId}/vomit-records`, label: "嘔吐記録" },
  { href: (catId) => `/cats/${catId}/symptoms`, label: "症状記録" },
  { href: (catId) => `/cats/${catId}/medications`, label: "服薬記録" },
  { href: (catId) => `/cats/${catId}/hospital-visits`, label: "通院記録" },
];
