import type { Child } from "hono/jsx";
import { STYLES } from "./styles";

const NAV_ITEMS = [
  { href: "/", label: "概要" },
  { href: "/users", label: "ユーザー" },
  { href: "/households", label: "家" },
  { href: "/food-products", label: "共通のごはん商品" },
] as const;

/** パンくずの項目。`href` のない項目は今のページ */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Layout(props: {
  title: string;
  currentPath: string;
  /** メインアプリの Breadcrumb と同じく、見出しの上に一覧などへ戻るリンクを並べる */
  breadcrumb?: BreadcrumbItem[];
  /** 見出しの右に置く操作（登録ボタンなど） */
  actions?: Child;
  children: Child;
}) {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        {/* ライトテーマに固定する（ダークテーマなどの見た目の切り替えは持たない） */}
        <meta name="color-scheme" content="light" />
        <title>{`${props.title} | CANSHI 管理画面`}</title>
        <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      </head>
      <body>
        <header>
          <h1>CANSHI 管理画面</h1>
          <nav>
            {NAV_ITEMS.map((item) => (
              <a
                href={item.href}
                aria-current={
                  item.href === props.currentPath ? "page" : undefined
                }
              >
                {item.label}
              </a>
            ))}
          </nav>
        </header>
        <main>
          {props.breadcrumb && (
            <nav aria-label="パンくずリスト" class="breadcrumb">
              <ol>
                {props.breadcrumb.map((item, index) => (
                  <li>
                    {index > 0 && (
                      <span class="separator" aria-hidden="true">
                        /
                      </span>
                    )}
                    {item.href ? (
                      <a href={item.href}>{item.label}</a>
                    ) : (
                      <span aria-current="page" class="current">
                        {item.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div class="page-header">
            <h2>{props.title}</h2>
            {props.actions}
          </div>
          {props.children}
        </main>
      </body>
    </html>
  );
}
