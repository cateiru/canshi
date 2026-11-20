/**
 * CSS は文字列として import する。wrangler.jsonc の `rules`（Text）と、テストでは
 * vitest.config.ts の `cssAsText` プラグインで同じように読み込む
 */
declare module "*.css" {
  const text: string;
  export default text;
}
