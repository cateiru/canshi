/**
 * ヘルプの手順に添える、ログイン中のユーザーの家・ねこの画面への導線。
 * ヘルプはログインしていなくても見られるため、ログインしていないときや、
 * 開く先の家・ねこがないときは導線を出さない
 */

/** 導線を作るのに使う、ログイン中のユーザーの家 */
export type HelpShortcutHousehold = {
  id: string;
  name: string;
  role: "owner" | "member";
};

/** 導線を作るのに使う、ログイン中のユーザーのねこ */
export type HelpShortcutCat = {
  id: string;
  name: string;
  memorialDate: string | null;
};

/** ログイン中のユーザーの家・ねこ。ログインしていなければ null */
export type HelpShortcutContext = {
  households: HelpShortcutHousehold[];
  cats: HelpShortcutCat[];
} | null;

/** 導線の種類（どの手順に添えるか） */
export type HelpShortcutTarget =
  /** 家を作成する（ログイン中なら出す） */
  | "household-new"
  /** 家族を招待するための家の設定（オーナーの家だけ） */
  | "household-invitation"
  /** 家ごとのねこの登録 */
  | "cat-new"
  /** ねこの画面（メモリーへ移したねこは記録できないため除く） */
  | "cat-detail"
  /** 家ごとのごはん商品一覧 */
  | "food-products"
  /** 家ごとのごはんの時間 */
  | "feeding-schedules"
  /** 通知設定（ログイン中なら出す） */
  | "notification-settings"
  /** ねこごとの通知設定（メモリーへ移したねこは変えられないため除く） */
  | "cat-notification-settings";

export type HelpShortcut = {
  href: string;
  label: string;
};

function householdQuery(householdId: string): string {
  return `?householdId=${encodeURIComponent(householdId)}`;
}

function activeCats(cats: HelpShortcutCat[]): HelpShortcutCat[] {
  return cats.filter((cat) => cat.memorialDate == null);
}

/** 手順に添える導線を返す。出すものがなければ空の配列 */
export function buildHelpShortcuts(
  target: HelpShortcutTarget,
  context: HelpShortcutContext,
): HelpShortcut[] {
  if (!context) {
    return [];
  }
  const { households, cats } = context;

  switch (target) {
    case "household-new":
      return [{ href: "/settings/households/new", label: "家を作成する" }];
    case "household-invitation":
      return households
        .filter((household) => household.role === "owner")
        .map((household) => ({
          href: `/settings/households/${encodeURIComponent(household.id)}`,
          label: `${household.name}の設定`,
        }));
    case "cat-new":
      return households.map((household) => ({
        href: `/cats/new${householdQuery(household.id)}`,
        label: `${household.name}にねこを登録する`,
      }));
    case "cat-detail":
      return activeCats(cats).map((cat) => ({
        href: `/cats/${encodeURIComponent(cat.id)}`,
        label: `${cat.name}の画面`,
      }));
    case "food-products":
      return households.map((household) => ({
        href: `/food-products${householdQuery(household.id)}`,
        label: `${household.name}のごはん商品一覧`,
      }));
    case "feeding-schedules":
      return households.map((household) => ({
        href: `/settings/households/${encodeURIComponent(household.id)}/feeding-schedules`,
        label: `${household.name}のごはんの時間`,
      }));
    case "notification-settings":
      return [{ href: "/settings/notifications", label: "通知設定" }];
    case "cat-notification-settings":
      return activeCats(cats).map((cat) => ({
        href: `/cats/${encodeURIComponent(cat.id)}/notification-settings`,
        label: `${cat.name}の通知設定`,
      }));
  }
}
