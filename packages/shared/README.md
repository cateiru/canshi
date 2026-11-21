# @canshi/shared

メインアプリ（リポジトリルートの `canshi`）・管理画面（[`packages/admin`](../admin)）と、今後作る
LP などのパッケージで使う共通の実装を置くパッケージ。

## 置くもの・置かないもの

どのアプリからも使えるよう、特定のフレームワーク（Next.js・Hono）やアプリの実装に依存しないものだけを置く。

- 置く：CSS、React のコンポーネント（React Aria・CSS Modules を使ってよい）、純粋な関数・定数
- 置かない：Next.js（`next/*`）・Hono・`@opennextjs/cloudflare` に依存するもの、D1・R2 を読み書きするもの、
  アプリの実装（`@/*`）を import するもの、業務の規則（各機能の `domain/` に置く）

Next.js などへの依存は Biome の `noRestrictedImports`（`biome.json` の `packages/shared/**` の overrides）で禁止している。

ビルドの手順は持たず、ソース（`.css`・`.ts`・`.tsx`）を `package.json` の `exports` で公開する。
使う側（Next.js・Vite・Vitest）がそれぞれバンドルする。

| パス | 内容 |
| --- | --- |
| `@canshi/shared/styles/tokens.css`（`src/styles/tokens.css`） | デザイントークン（色・文字・余白などの CSS カスタムプロパティ）。見た目設定のテーマ・アクセントカラー・コントラスト・文字サイズは `<html>` の data 属性で切り替える |
| `@canshi/shared/ui`（`src/ui/index.ts`） | UI コンポーネント（Button・Modal・Select など）。CSS Modules のクラスはトークンを参照するため、使う側で tokens.css を読み込んでおく |
| `@canshi/shared/ui/RecordIcons`・`ui/ScaledIcon`・`ui/buttonStyles` | `ui` の index に含めていない記録のアイコンと、アイコンの大きさ・ボタンのクラス名の部品 |
| `@canshi/shared/ui/RecordCard.module.css` | 記録カードの面の CSS（CSS Modules の `composes` で使う） |

## リンク・ページ移動の差し込み（DI）

リンクを含むコンポーネント（`ButtonLink`・`IconButtonLink`・`NavCard`・`Breadcrumb`・`FilterTabs`・`Footer`・
`Pagination`・`MonthNav`）は、リンクを描くコンポーネントを `linkComponent` で受け取る
（`src/ui/Link/Link.tsx` の `LinkComponent`）。省略すると素の `<a>`（`AnchorLink`）で描く。
`DropdownMenu` は、メニュー項目の `href` へ移動する関数を `navigate` で受け取る。省略するとブラウザの通常の移動になる。

`LinkComponent` が受け取る props は、`<a>` の属性と `href`（文字列）に、移動の仕方のヒント
（`replace`・`transitionTypes`）を足したもの。ヒントに対応しない実装では無視してよい。

Server Component からも使えるよう、React の Context ではなく props で渡す（Context は Client Component でしか
読めず、アイコンなどの関数を Server Component から Client Component へ渡すこともできないため）。
使う側は、ルーターのリンクを差し込んだ同じ名前のコンポーネントを用意して使う。

- メインアプリ：`src/components/ui/index.ts` が `@canshi/shared/ui` をすべて export し、リンクを含むものを
  `next/link` を差し込んだもの（`src/components/ui/links.tsx`）で、`DropdownMenu` を `useRouter().push` を
  差し込んだもの（`src/components/ui/DropdownMenu.tsx`）で上書きする。画面からは今までどおり
  `@/components/ui` から import する。
- Next.js 以外（LP など）：`linkComponent` を省略すれば素の `<a>` で動く。ルーターを使うときは、
  同じように差し込んだものを用意する。

## 使う側

- メインアプリ：`src/styles/globals.css` の先頭で `@import "@canshi/shared/styles/tokens.css";` し、UI は
  `@/components/ui`（上の差し込み）から使う。
- 管理画面：React の SPA（`packages/admin/src/client`）で、`src/client/global.css` の先頭で
  `@import "@canshi/shared/styles/tokens.css";` し、UI は `@canshi/shared/ui` から直接使う。リンクを含むものには
  react-router のリンクを差し込んだ `RouterLink`（`src/client/RouterLink.tsx`）を `linkComponent` で渡す。
  `<html>` に `data-theme="light"` を付け、ライトテーマ・標準のコントラスト・標準の文字サイズに固定する。

公開するものを足すときは、`package.json` の `exports` に追加する。依存を足すときは、複数のパッケージで使う
もののバージョンをリポジトリルートの `pnpm-workspace.yaml` の `catalog` で決める（`react`・`react-dom` は
例外で、ルートの `package.json` と同じ版を `devDependencies` に書く。理由は `pnpm-workspace.yaml` のコメントを参照）。

管理画面は tokens.css と UI コンポーネントを使うため、このパッケージが変わったときもデプロイし直す必要がある。Workers Builds の
Build watch paths（[`docs/deploy.md`](../../docs/deploy.md) の「管理画面の自動デプロイとプレビュー」節）と、
CI の管理画面の VRT を実行するかの判定（`.github/workflows/ci.yml` の `admin-changes`）に
`packages/shared/` を含めている。

## 開発コマンド

リポジトリルートから `pnpm --filter @canshi/shared <script>` で実行するか、このディレクトリで直接
実行する。

```bash
pnpm typecheck         # tsc --noEmit
pnpm test              # vitest run（UI コンポーネントは jsdom で実行する）
pnpm storybook         # Storybook を http://localhost:6006 で起動する
pnpm build-storybook   # Storybook を storybook-static/ にビルドする
```

## Storybook

UI コンポーネントとデザイントークンの見本を Storybook（`@storybook/react-vite`）で表示する。
ストーリーは各コンポーネントの隣に `<コンポーネント>.stories.tsx` として置き、設定は `.storybook/` に置く。

- `.storybook/preview.tsx` で tokens.css と、メインアプリの `globals.css` のうち文字・背景・リセットの
  指定（`.storybook/preview.css`）を読み込む。
- ツールバーで、見た目設定のテーマ・アクセントカラー・コントラスト・文字サイズを切り替えられる
  （メインアプリと同じく `<html>` の data 属性を書き換える）。
- リンクを含むコンポーネントは `linkComponent` を渡さず、素の `<a>` で表示する。

コンポーネントを足したり、見た目の出し分け（props）を足したりしたときは、ストーリーも合わせて追加する。

PR で `packages/shared/`・共通のパッケージの VRT の設定（下の「VRT」）・依存関係（`package.json`・
`pnpm-lock.yaml`・`pnpm-workspace.yaml`）・`.github/workflows/ci.yml`・`.github/actions/` を変えたときは、
CI（`.github/workflows/ci.yml` の `shared-storybook`）が Storybook をビルドし、VRT と同じ
[public-storage-cdk](https://github.com/cateiru/public-storage-cdk) のバケットの
`canshi/shared-storybook/<PR の先頭のコミット>/` に置いて、URL を PR にコメントする。
置いたファイルには `auto-expire` タグを付け、180 日後に自動で消す。

コンポーネントの一覧は、メインアプリの開発用ページ（`/dev/components`）ではなく、この Storybook で見る。

## VRT

Storybook のストーリーを Playwright で 1 つずつ撮り、reg-suit で前のコミットと比べる
（ビジュアルリグレッションテスト）。テストはリポジトリルートの `e2e-shared/vrt.spec.ts`、設定は
`playwright.shared-vrt.config.ts` と `regconfig.shared.json` にある。

- ビルドした Storybook の `storybook-static/index.json` からストーリーを読むため、ストーリーを足すと
  自動で撮影の対象になる。実行するたびに見た目が変わるストーリーは、`tags: ["no-vrt"]` を付けて除く。
- すべてのストーリーをライト・ダークテーマで撮る。コントラスト・アクセントカラー・文字サイズは、
  それぞれの設定が効く部品のストーリーで代表して撮る（`e2e-shared/vrt.spec.ts` の `ACCENT_STORIES` など）。
  見た目設定は、ツールバーと同じ globals を URL で渡して切り替える。
- Select の候補・DropdownMenu のメニューを開いた見た目も撮る。
- JavaScript のアニメーション（紙吹雪など）は、端末で動きを減らす設定（`prefers-reduced-motion`）にして止める。

メインアプリの VRT（`e2e/vrt.spec.ts`）は画面を撮り、部品だけの見た目はここで撮る。

CI の `vrt-shared` ジョブは、main への push では毎回（どのコミットにも比較のもとになるスナップショットが
あるように）、PR では上の Storybook の公開と同じファイルを変えたときに実行する。結果は
`canshi/vrt-shared/<コミット>/` に置き、PR にコメントする。

ローカルではリポジトリルートで次のように実行する（Storybook をビルドしてから撮る）。撮った画像は
`vrt-screenshots/shared/actual/` に書き出す。

```bash
pnpm vrt:shared
```
