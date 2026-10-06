import type { Child } from "hono/jsx";

// 固定の CSS。JSX の子要素として渡すと `"`・`>` がエスケープされて壊れるため、
// dangerouslySetInnerHTML で埋め込む（利用者の入力は含めないこと）
const STYLES = `
:root {
  color-scheme: light dark;
  --fg: #1f2328;
  --muted: #59636e;
  --bg: #ffffff;
  --border: #d1d9e0;
  --accent: #0969da;
  --warn-bg: #fff8c5;
  --warn-border: #d4a72c;
}
@media (prefers-color-scheme: dark) {
  :root {
    --fg: #f0f6fc;
    --muted: #9198a1;
    --bg: #0d1117;
    --border: #3d444d;
    --accent: #4493f8;
    --warn-bg: #272115;
    --warn-border: #9e6a03;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 1.5rem 1rem 3rem;
  font-family: system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif;
  color: var(--fg);
  background: var(--bg);
  line-height: 1.6;
}
main, header { max-width: 64rem; margin: 0 auto; }
header { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; align-items: baseline; margin-bottom: 1.5rem; }
header h1 { font-size: 1.25rem; margin: 0; }
nav { display: flex; gap: 1rem; }
a { color: var(--accent); }
nav a[aria-current="page"] { font-weight: bold; text-decoration: none; color: var(--fg); }
h2 { font-size: 1.125rem; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 0.875rem; }
th, td { border-bottom: 1px solid var(--border); padding: 0.5rem; text-align: left; vertical-align: top; }
th { color: var(--muted); font-weight: normal; white-space: nowrap; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
code { font-size: 0.8125rem; color: var(--muted); }
ul.plain { list-style: none; margin: 0; padding: 0; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); gap: 1rem; }
.stat { border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.75rem 1rem; }
.stat dt { color: var(--muted); font-size: 0.875rem; }
.stat dd { margin: 0; font-size: 1.5rem; font-variant-numeric: tabular-nums; }
.warning { border: 1px solid var(--warn-border); background: var(--warn-bg); border-radius: 0.5rem; padding: 0.75rem 1rem; margin-top: 1rem; }
.empty { color: var(--muted); }
`;

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
