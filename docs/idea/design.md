# デザインドキュメント

- デザインに一貫性をもたせるために事前にガイドラインを策定する

## デザインコンセプト

- 「猫」をテーマにしたデザイン
- 基本的にモノトーンのテーマとしてベース背景色＋文字色で構成する
- アイコンなど一部のものに対してはアクセント色を使用する

## デザイン原則

- 少し丸みがかった輪郭
  - `border-radius: 4px;` を基本とする。それ以外で丸みを付けない
- ソリッドな枠線
  - UI 要素の輪郭は文字色の実線ボーダーで描く。淡い線やグラデーションは使わない
- 耳の形
  - UI 要素の左上には猫耳を模した装飾を付ける
  - `_` を枠線とすると、`___^__^___` のような形になる。枠線の一部として猫耳を表現する
  - 耳は塗りつぶさず `--color-ink` の輪郭線のみで表現し、内側は `--color-bg` にする（モーダルの半透明オーバーレイ上でも視認できるようにするため）

## デザイントークン

- `--color-bg`: #fff
- `--color-ink`: #2e3142
- `--color-accent`: #ec995a
- `--color-success`: #52b355
- `--color-warning`: #f2d14b
- `--color-error`: #f25c4b
- `--color-info`: #4f87db

## タイポグラフィ

Web フォントは読み込まず、システムフォントのみを使用する。

```css
--font-sans:
  system-ui, -apple-system, "Hiragino Sans", "Yu Gothic UI", "Yu Gothic",
  "Noto Sans JP", sans-serif;
```

| トークン  | サイズ | ウェイト | 用途                             |
| --------- | ------ | -------- | -------------------------------- |
| --text-xl | 24px   | 700      | ページタイトル（サービスロゴ）   |
| --text-lg | 18px   | 700      | モーダル見出し・セクション見出し |
| --text-md | 15px   | 700      | カードなど                       |
| --text-sm | 13px   | 400      | 本文・サービス名                 |
| --text-xs | 11px   | 700      | ジャンルバッジ・チップ           |

- `line-height` は本文 1.7、見出し 1.4 を基本とする

## スペーシング

4px を基数としたスケールを使用する。

| トークン    | 値     |
| ----------- | ------ |
| `--space-1` | `4px`  |
| `--space-2` | `8px`  |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-6` | `24px` |
| `--space-8` | `32px` |

## モーション

- インタラクティブな要素（ボタン・入力欄など）には hover・focus 時の状態変化を必ず付ける
- `--transition-base` を基本のトランジション速度として使用する
- ボタンは hover で `opacity: 0.85`、押下時（active）は `translateY(1px)` でわずかに沈み込ませる
- フォーカスリングはマウスクリックでは出さず、キーボード操作時のみ `:focus-visible` で表示する
- フォーカスリングは `--focus-ring-width`（太さ）・`--focus-ring-offset`（要素との余白）・`--color-accent`（色）で統一する
- 入力欄は hover・focus で枠線を `--color-info` に変える（エラー状態は hover 時も `--color-error` を維持する）
- `prefers-reduced-motion: reduce` の環境では `--transition-base` を `0ms` にしてトランジションを無効化する（`globals.css` でグローバルに対応済み）

## バッジ

バッジは文字色・背景色は変えず、輪郭の色のみで表現する

```css
.badge {
  border: 1px solid var(--color-info);
  color: var(--color-ink);
  background-color: var(--color-bg);
}
```
