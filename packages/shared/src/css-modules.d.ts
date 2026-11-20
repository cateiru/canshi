// CSS Modules（`*.module.css`）の型。クラス名から、使う側のバンドラー（Next.js など）が
// 付けたクラス名を引く
declare module "*.module.css" {
  const classes: { readonly [className: string]: string };
  export default classes;
}

// CSS をそのまま文字列として読み込む（Vite の `?raw`）。Storybook でトークンの一覧を作るときに使う
declare module "*.css?raw" {
  const content: string;
  export default content;
}
