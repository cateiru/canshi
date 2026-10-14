import type { Child } from "hono/jsx";
import { STYLES } from "./styles";

const NAV_ITEMS = [
  { href: "/", label: "概要" },
  { href: "/users", label: "ユーザー" },
  { href: "/households", label: "家" },
] as const;

export function Layout(props: {
  title: string;
  currentPath: string;
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
          <h2>{props.title}</h2>
          {props.children}
        </main>
      </body>
    </html>
  );
}
