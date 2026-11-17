# ヘルプ

アプリの使い方を説明するヘルプ（`/help/*`）。ログインしていなくても見られる
（`src/features/auth/domain/publicPaths.ts`）。業務の規則を持たないため、層に分けずに置く。

## 構成

- `topics.ts`: ヘルプの記事の一覧（`/help` の並び・見出し・アイコン）。記事を追加したらここにも追加する
- `recordHelps.ts`: 記録の種類ごとの記事（`/help/records/<記録の種類>`）の中身
- `HelpArticle.tsx`: 記事の共通の枠（パンくず・見出し・関連するヘルプ）
- `HelpSteps.tsx`・`HelpScreenshot.tsx`: 手順と、スマートフォンの画面のスクリーンショット
- `HelpFlow.tsx`: 矢印でつないだ流れの図（はじめての流れ・しくみの説明）。イラストのアイコンと短い説明を並べる
- `HouseholdDiagram.tsx`: 家・メンバー・ねこ・記録の関係の図
- `contextualHelp.ts`・`HeaderHelpLink.tsx`: ヘッダーのヘルプのリンク。開いている画面のパスから、
  その画面の使い方の記事を選ぶ（対応する記事がなければ一覧へ進める）。画面や記事を追加したら
  `contextualHelp.ts` の対応も見直す
- 記事のページは `src/app/help/<slug>/page.tsx` に置く

記事の最後には、説明した画面をすぐ開けるボタン（`HelpContent.module.css` の `.actions`）を置く。

## スクリーンショット

`public/images/help/<name>.webp` に置き、名前は `screenshots.ts` の `HELP_SCREENSHOT_NAMES` で管理する。
画面を変えたときは、次のコマンドで撮り直せる（ローカルの D1 に、撮影用のユーザー・家・ねこを作る）。

```sh
pnpm db:migrate:local  # 初回のみ
pnpm help:screenshots
```

`pnpm help:screenshots` は `pnpm dev` を起動して `e2e/help-screenshots.capture.ts` を実行する。
撮影する環境のフォントによらず同じ見た目になるよう、撮影時は Google Fonts から Noto Sans JP を読み込んで
日本語のフォントをそろえる（インターネットに接続できる環境で実行すること）。
起動済みの dev サーバーを使う場合は、通知設定の画面を撮れるよう
`NEXT_PUBLIC_VAPID_PUBLIC_KEY=help-screenshots pnpm dev` で起動しておくこと
（`playwright.help-screenshots.config.ts` 参照）。
