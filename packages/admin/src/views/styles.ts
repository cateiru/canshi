// 管理画面の CSS。見た目はメインアプリのデザインルール（docs/idea/design.md）に揃える。
//
// トークンの正はメインアプリの `src/styles/tokens.css`。パッケージ境界をまたいで import せず、
// ライトテーマ・標準のコントラスト・標準の文字サイズのときの値だけを写している。管理画面は
// ダークテーマ・コントラスト・文字サイズの切り替えを持たず、ライトテーマに固定する。
// 写した値が tokens.css とずれていないことは styles.test.ts で確認している。

/** tokens.css の `:root` と同じ名前・値で宣言するトークン */
export const TOKENS = {
  "--color-bg": "#fff",
  "--color-ink": "#2e3142",
  "--color-accent": "#ec995a",
  "--color-success-strong": "#26732e",
  "--color-warning-strong": "#806000",
  "--color-error-strong": "#bd3528",
  "--color-info-strong": "#245da8",
  "--color-accent-strong": "#9a4b13",
  "--color-focus-ring": "var(--color-accent-strong)",
  "--font-sans":
    'system-ui, -apple-system, "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", "Noto Sans JP", sans-serif',
  "--text-xl": "26px",
  "--text-lg": "20px",
  "--text-md": "17px",
  "--text-sm": "15px",
  "--text-xs": "12px",
  "--text-input": "16px",
  "--font-weight-bold": "700",
  "--font-weight-regular": "400",
  "--line-height-body": "1.7",
  "--line-height-heading": "1.4",
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-4": "16px",
  "--space-6": "24px",
  "--space-8": "32px",
  "--space-10": "40px",
  "--radius-base": "4px",
  "--border-width": "1px",
  "--transition-base": "150ms ease",
  "--focus-ring-width": "2px",
  "--focus-ring-offset": "1px",
} as const;

const tokenDeclarations = Object.entries(TOKENS)
  .map(([name, value]) => `  ${name}: ${value};`)
  .join("\n");

// 固定の CSS。JSX の子要素として渡すと `"`・`>` がエスケープされて壊れるため、
// dangerouslySetInnerHTML で埋め込む（利用者の入力は含めないこと）
export const STYLES = `
:root {
  color-scheme: light;
${tokenDeclarations}
  /* tokens.css で --mix-* の割合から計算している色。標準のコントラストの割合で固定する */
  --color-border: color-mix(in srgb, var(--color-ink) 20%, var(--color-bg));
  --color-border-input: color-mix(in srgb, var(--color-ink) 62%, var(--color-bg));
  --color-ink-muted: color-mix(in srgb, var(--color-ink) 78%, var(--color-bg));
  --color-ink-subtle: color-mix(in srgb, var(--color-ink) 70%, var(--color-bg));
  /* 淡い背景の面（記録カードと同じ）と、その hover */
  --color-surface: color-mix(in srgb, var(--color-ink) 4%, var(--color-bg));
  --color-surface-hover: color-mix(in srgb, var(--color-ink) 7%, var(--color-bg));
}
@media (prefers-reduced-motion: reduce) {
  :root { --transition-base: 0ms; }
}
* { box-sizing: border-box; }
html { background-color: var(--color-bg); }
body {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-body);
  color: var(--color-ink);
  background-color: var(--color-bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-wrap: break-word;
}
h1, h2 { margin: 0; line-height: var(--line-height-heading); }
header, main {
  width: 100%;
  max-width: 80rem;
  margin: 0 auto;
  padding: 0 var(--space-4);
}
header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-6);
  padding-top: var(--space-6);
}
header h1 { font-size: var(--text-lg); }
main {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding-top: var(--space-8);
  padding-bottom: var(--space-10);
}
main h2 { font-size: var(--text-xl); }
a {
  color: var(--color-ink);
  text-decoration: underline;
  border-radius: var(--radius-base);
  outline: var(--focus-ring-width) solid transparent;
  outline-offset: var(--focus-ring-offset);
  transition: outline-color var(--transition-base);
}
a:hover { text-decoration: none; }
a:focus-visible { outline-color: var(--color-focus-ring); }

/* ページの切り替え。メインアプリの FilterTabs と同じ見た目にする */
nav { display: flex; flex-wrap: wrap; gap: var(--space-2); }
nav a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  border-radius: 8px;
  background: var(--color-surface);
  text-decoration: none;
}
nav a:hover { background: var(--color-surface-hover); }
nav a[aria-current="page"] {
  background: color-mix(in srgb, var(--color-accent) 18%, var(--color-bg));
  font-weight: var(--font-weight-bold);
  /* 背景の差だけに頼らず、枠でも現在のページを示す */
  box-shadow: inset 0 0 0 2px var(--color-accent-strong);
}

/* 表は淡い背景の面にまとめ、行の区切りだけに罫線を使う */
.table-wrap {
  overflow-x: auto;
  border-radius: 16px;
  background: var(--color-surface);
  padding: var(--space-2) var(--space-4);
}
/* 狭い画面でも PC 幅と同じ列幅で表示し、.table-wrap の中で横にスクロールさせる */
table { border-collapse: collapse; width: 100%; min-width: 60rem; }
th, td {
  padding: var(--space-3) var(--space-2);
  text-align: left;
  vertical-align: top;
}
tbody tr + tr td { border-top: var(--border-width) solid var(--color-border); }
th {
  color: var(--color-ink-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-bold);
  white-space: nowrap;
}
td.nowrap { white-space: nowrap; }
td.num {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
code { font-size: var(--text-xs); color: var(--color-ink-muted); }
ul.plain { list-style: none; margin: 0; padding: 0; }

/* 件数。淡い背景の面に、ラベルを控えめに・数値を大きく表示する */
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: var(--space-4);
  margin: 0;
}
.stat {
  border-radius: 12px;
  background: var(--color-surface);
  padding: var(--space-4);
}
.stat dt { color: var(--color-ink-muted); font-size: var(--text-sm); }
.stat dd {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  font-variant-numeric: tabular-nums;
}

/* メインアプリの Alert と同じく、状態色で塗りつぶして文字を背景色にする */
.notice, .warning {
  margin: 0;
  border-radius: var(--radius-base);
  padding: var(--space-3) var(--space-4);
  color: var(--color-bg);
}
.notice { background-color: var(--color-info-strong); }
.warning { background-color: var(--color-warning-strong); }
.notice code, .warning code { color: inherit; }

/* メインアプリの Button と同じ見た目にする */
button {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: var(--border-width) solid var(--color-ink);
  border-radius: 8px;
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-heading);
  white-space: nowrap;
  cursor: pointer;
  color: var(--color-ink);
  background-color: var(--color-bg);
  outline: var(--focus-ring-width) solid transparent;
  outline-offset: var(--focus-ring-offset);
  transition:
    opacity var(--transition-base),
    transform var(--transition-base),
    outline-color var(--transition-base);
}
button:hover { opacity: 0.85; }
button:active { transform: translateY(1px); }
button:focus-visible { outline-color: var(--color-focus-ring); }
/* ログアウトさせる・家から外すなど、取り消せない操作 */
button.danger {
  color: var(--color-error-strong);
  border-color: var(--color-error-strong);
}

/* メインアプリの Select と同じく、白い背景と入力欄の枠線で識別できるようにする */
select {
  min-height: 44px;
  max-width: 16rem;
  border: var(--border-width) solid var(--color-border-input);
  border-radius: 8px;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--text-input);
  color: var(--color-ink);
  background-color: var(--color-bg);
  cursor: pointer;
  outline: var(--focus-ring-width) solid transparent;
  outline-offset: var(--focus-ring-offset);
  transition:
    border-color var(--transition-base),
    outline-color var(--transition-base);
}
select:hover { border-color: var(--color-accent-strong); }
select:focus-visible { outline-color: var(--color-focus-ring); }

td form { margin: 0; }
li.member {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  align-items: center;
  margin-bottom: var(--space-2);
}
form.add-member { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.empty { color: var(--color-ink-subtle); }
`;
