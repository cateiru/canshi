# @canshi/shared

メインアプリ（リポジトリルートの `canshi`）と管理画面（[`packages/admin`](../admin)）の両方で使う
共通の実装を置くパッケージ。

## 置くもの・置かないもの

両方から使えるよう、特定のフレームワークに依存しないものだけを置く。

- 置く：CSS、React・Next.js・Hono に依存しない TypeScript（純粋な関数・定数など）
- 置かない：React のコンポーネント（`src/components/ui` など）、Next.js・Hono・`@opennextjs/cloudflare`
  に依存するもの、D1・R2 を読み書きするもの、業務の規則（各機能の `domain/` に置く）

メインアプリの `src/components/ui` は React（React Aria・CSS Modules）で書かれており、Hono の JSX で
サーバーサイドレンダリングする管理画面ではそのまま使えないため、このパッケージには移していない。
管理画面とメインアプリの見た目は、下のデザイントークンを共有して揃える。

ビルドの手順は持たず、ソースのまま（`.css`・`.ts`）を `package.json` の `exports` で公開する。
使う側（Next.js・wrangler・Vitest）がそれぞれバンドルする。

| パス | 内容 |
| --- | --- |
| `@canshi/shared/styles/tokens.css`（`src/styles/tokens.css`） | デザイントークン（色・文字・余白などの CSS カスタムプロパティ）。見た目設定のテーマ・アクセントカラー・コントラスト・文字サイズは `<html>` の data 属性で切り替える |

## 使う側

- メインアプリ：`src/styles/globals.css` の先頭で `@import "@canshi/shared/styles/tokens.css";` する。
- 管理画面：`src/views/styles.ts` で tokens.css を文字列として import し、`<style>` に埋め込む
  （`wrangler.jsonc` の `rules` で `.css` を Text モジュールにし、テストでは `vitest.config.ts` の
  プラグインで同じように読み込む）。`<html>` に `data-theme="light"` を付け、ライトテーマ・標準の
  コントラスト・標準の文字サイズに固定する。

両方で使うものを足すときは、`package.json` の `exports` に追加する。依存を足すときは、両方で使う
パッケージのバージョンはリポジトリルートの `pnpm-workspace.yaml` の `catalog` で決める。

管理画面は、このパッケージが変わったときもデプロイし直す必要がある。Workers Builds の
Build watch paths（[`docs/deploy.md`](../../docs/deploy.md) の「管理画面の自動デプロイとプレビュー」節）と、
CI の管理画面の VRT を実行するかの判定（`.github/workflows/ci.yml` の `admin-changes`）に
`packages/shared/` を含めている。

## 開発コマンド

リポジトリルートから `pnpm --filter @canshi/shared <script>` で実行するか、このディレクトリで直接
実行する。

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
```
