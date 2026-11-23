import { FilterTabs } from "@canshi/shared/ui";
import { Outlet, useLocation } from "react-router";
import { RouterLink } from "../RouterLink";
import styles from "./Layout.module.css";

const NAV_ITEMS = [
  { key: "/", href: "/", label: "概要" },
  { key: "/users", href: "/users", label: "ユーザー" },
  { key: "/households", href: "/households", label: "家" },
  { key: "/food-products", href: "/food-products", label: "共通のごはん商品" },
  {
    key: "/food-product-requests",
    href: "/food-product-requests",
    label: "リクエスト",
  },
  { key: "/ai-connections", href: "/ai-connections", label: "AIとの接続" },
] as const;

/** 今のパスが属するナビゲーションの項目（登録・編集ページは一覧の項目） */
function currentNavKey(pathname: string) {
  const item = NAV_ITEMS.find(
    (navItem) =>
      navItem.key !== "/" &&
      (pathname === navItem.key || pathname.startsWith(`${navItem.key}/`)),
  );
  return item?.key ?? (pathname === "/" ? "/" : "");
}

/** すべてのページに共通の見出しとナビゲーション */
export function Layout() {
  const { pathname } = useLocation();
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>CANSHI 管理画面</h1>
        <FilterTabs
          aria-label="ページ"
          items={NAV_ITEMS}
          selectedKey={currentNavKey(pathname)}
          linkComponent={RouterLink}
        />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </>
  );
}
