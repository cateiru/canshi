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
  "--color-error": "#f25c4b",
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
header nav { display: flex; flex-wrap: wrap; gap: var(--space-2); }
header nav a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  border-radius: 8px;
  background: var(--color-surface);
  text-decoration: none;
}
header nav a:hover { background: var(--color-surface-hover); }
header nav a[aria-current="page"] {
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
  border-radius: 12px;
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
  /* メインアプリの Select と同じ矢印にする */
  appearance: none;
  padding-right: calc(var(--space-3) * 2 + 10px);
  background: var(--color-bg) right var(--space-3) center / 10px 6px no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpolyline points='1 1 5 5 9 1' fill='none' stroke='%232e3142' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
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
/* 権限の選択と変更ボタンは横に並べたままにし、行が縦に伸びないようにする */
form.role-form { display: flex; gap: var(--space-2); }
.empty { color: var(--color-ink-subtle); }

/* ページの見出しと、その右に置く操作（メインアプリの一覧ページの見出しと同じ並び） */
.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
/* メインアプリの Breadcrumb と同じ見た目にする */
.breadcrumb { font-size: var(--text-xs); }
.breadcrumb ol {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.breadcrumb li { display: flex; align-items: center; gap: var(--space-1); min-width: 0; }
.breadcrumb .separator { opacity: 0.5; }
.breadcrumb .current { opacity: 0.7; }
/* 一覧の説明 */
.lead { margin: 0; color: var(--color-ink-muted); }
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
svg.icon { flex-shrink: 0; }

/* 画面を移動するリンクを、メインアプリの ButtonLink と同じ見た目にする */
a.button-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 44px;
  border: var(--border-width) solid var(--color-ink);
  border-radius: 8px;
  padding: var(--space-2) var(--space-4);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-heading);
  text-decoration: none;
  transition:
    opacity var(--transition-base),
    transform var(--transition-base),
    outline-color var(--transition-base);
}
a.button-link:hover { opacity: 0.85; }
a.button-link:active { transform: translateY(1px); }
/* 主操作は --color-ink の背景と --color-bg の文字で強調する（メインアプリの Button の primary） */
a.button-link.primary, button.primary {
  color: var(--color-bg);
  background-color: var(--color-ink);
}
button:disabled { cursor: not-allowed; opacity: 0.5; }
button[type="submit"].primary { min-height: 48px; font-size: var(--text-md); }
/* アイコンだけの操作（メインアプリの IconButton） */
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  min-width: 44px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  color: var(--color-ink);
  background: transparent;
  transition:
    background-color var(--transition-base),
    outline-color var(--transition-base);
}
.icon-button:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--color-ink) 7%, var(--color-bg));
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
}
.actions form { margin: 0; }

/* 商品画像（メインアプリの FoodProductImage）。画像がないときは淡い面にアイコンを置く */
.product-image {
  display: block;
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
  background: var(--color-bg);
}
.product-image.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-ink-subtle);
}
.product-name { display: block; font-weight: var(--font-weight-bold); }
.package-size { display: block; }
td .sub { display: block; color: var(--color-ink-muted); }
td code { display: block; }

/* 登録・編集フォーム。メインアプリのごはん商品のフォームと同じ幅・間隔にする */
form.product-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 800px;
}
.field { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
.field > label, .field-label {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-bold);
}
.form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  align-items: start;
}
@media (max-width: 480px) {
  .form-row { grid-template-columns: minmax(0, 1fr); }
}
.field-description { margin: 0; font-size: var(--text-sm); color: var(--color-ink-subtle); }
.field-error { margin: 0; font-size: var(--text-xs); color: var(--color-error-strong); }
fieldset .field-error { font-size: var(--text-sm); }

/* メインアプリの FormField と同じく、白い背景と入力欄の枠線で識別できるようにする */
input[type="text"], input[type="number"], textarea {
  width: 100%;
  min-height: 48px;
  border: var(--border-width) solid var(--color-border-input);
  border-radius: 8px;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-sans);
  font-size: var(--text-input);
  color: var(--color-ink);
  background-color: var(--color-bg);
  outline: var(--focus-ring-width) solid transparent;
  outline-offset: var(--focus-ring-offset);
  transition:
    border-color var(--transition-base),
    outline-color var(--transition-base);
}
input[type="text"]:hover, input[type="number"]:hover, textarea:hover { border-color: var(--color-accent-strong); }
input:focus, textarea:focus { outline-color: transparent; }
input:focus-visible, textarea:focus-visible { outline-color: var(--color-focus-ring); }
textarea { resize: vertical; line-height: var(--line-height-body); }
input[aria-invalid="true"], input[aria-invalid="true"]:hover,
textarea[aria-invalid="true"], textarea[aria-invalid="true"]:hover,
select[aria-invalid="true"], select[aria-invalid="true"]:hover {
  border-color: var(--color-error);
}
form.product-form select { width: 100%; max-width: none; min-height: 48px; }
@media (max-width: 480px) {
  input[type="text"], input[type="number"], textarea { padding-inline: var(--space-2); }
}

/* チェックボックスのまとまり（メインアプリの FormGroup） */
fieldset.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  margin: 0;
  padding: var(--space-4);
  border: 0;
  border-radius: 16px;
  background: var(--color-surface);
}
fieldset.group legend {
  padding-inline: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-bold);
}
/* 内容量の候補の行（g・単位・削除ボタン） */
.package-size-rows { display: flex; flex-direction: column; gap: var(--space-3); }
.package-size-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: start;
}
button.with-icon { gap: var(--space-2); }
.checkboxes { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); }
/* メインアプリの Checkbox と同じく、--color-ink の枠と塗りつぶしで選択を示す */
label.checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  font-size: var(--text-sm);
  cursor: pointer;
}
label.checkbox input {
  appearance: none;
  flex-shrink: 0;
  display: inline-grid;
  place-content: center;
  width: 18px;
  height: 18px;
  margin: 0;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-base);
  background-color: var(--color-bg);
  cursor: pointer;
  outline: var(--focus-ring-width) solid transparent;
  outline-offset: var(--focus-ring-offset);
  transition:
    border-color var(--transition-base),
    outline-color var(--transition-base);
}
label.checkbox input::before {
  content: "";
  width: 10px;
  height: 10px;
  background: center / contain no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpolyline points='1.5 5.5 4 8 8.5 2' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  opacity: 0;
  transition: opacity var(--transition-base);
}
label.checkbox input:checked { background-color: var(--color-ink); }
label.checkbox input:checked::before { opacity: 1; }
label.checkbox:hover input { border-color: var(--color-accent-strong); }
label.checkbox input:checked:hover { border-color: var(--color-ink); }

/* 商品画像の選択欄（メインアプリの画像の選択欄）。透明なファイル入力欄を点線の枠に重ねる */
.image-field { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-3); }
.product-image.current-image { width: 160px; height: 160px; }
.product-image[hidden] { display: none; }
.file-chooser {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  width: 100%;
  max-width: 320px;
  min-height: 160px;
  padding: var(--space-4);
  border: var(--border-width) dashed var(--color-ink);
  border-radius: var(--radius-base);
  text-align: center;
  cursor: pointer;
  transition:
    background-color var(--transition-base),
    border-color var(--transition-base);
}
.file-chooser:hover, .file-chooser:has(input:focus-visible) {
  border-color: var(--color-accent);
  background-color: color-mix(in srgb, var(--color-accent) 12%, var(--color-bg));
}
.file-chooser:has(input:focus-visible) {
  outline: var(--focus-ring-width) solid var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
}
.file-chooser input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.file-chooser svg.icon { width: 26px; height: 26px; }
.file-chooser-title { font-size: var(--text-sm); font-weight: var(--font-weight-bold); }
.file-chooser-note { font-size: var(--text-xs); overflow-wrap: anywhere; }

/* 商品画像の切り抜く範囲を選ぶダイアログ（メインアプリの Modal と切り抜きの UI） */
dialog.crop-dialog {
  width: min(400px, calc(100vw - var(--space-8)));
  max-height: calc(100dvh - var(--space-8));
  overflow: auto;
  padding: var(--space-6);
  border: var(--border-width) solid var(--color-ink);
  border-radius: 16px;
  color: var(--color-ink);
  background: var(--color-bg);
}
dialog.crop-dialog[open] { display: flex; flex-direction: column; gap: var(--space-3); }
dialog.crop-dialog::backdrop { background: color-mix(in srgb, var(--color-ink) 50%, transparent); }
dialog.crop-dialog h2 { font-size: var(--text-lg); }
.crop-canvas {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border: var(--border-width) solid var(--color-ink);
  border-radius: var(--radius-base);
  background: var(--color-surface);
  cursor: grab;
  touch-action: none;
  outline: var(--focus-ring-width) solid transparent;
  outline-offset: var(--focus-ring-offset);
}
.crop-canvas:active { cursor: grabbing; }
.crop-canvas:focus-visible { outline-color: var(--color-focus-ring); }
.crop-zoom {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-bold);
}
.crop-zoom input { flex: 1; min-width: 0; accent-color: var(--color-ink); }
.crop-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
`;
