# 01. プロジェクト基盤構築

## 目的

Next.js アプリケーションの雛形と、以降の全 PR が前提とする開発ツールチェーンを整備する。

## スコープ

- Next.js（App Router・TypeScript）プロジェクトの作成
- Biome（Linter／Formatter）の導入・設定
- Vitest（単体・結合テスト）の導入・設定
- CSS Modules + PostCSS のセットアップ
- Tabler Icons（react-icons）の導入
- `@opennextjs/cloudflare` の導入と `wrangler.toml` の最小構成（`nodejs_compat` 有効化）
- pnpm によるパッケージ管理への統一
- ディレクトリ構成の決定（例：`src/app`、`src/components`、`src/features`、`src/db` など）
- CI（Lint・型チェック・テスト）を GitHub Actions で最小構成する
- Playwright（E2E テスト）の導入とプロジェクト設定（実際のシナリオ実装は最初の記録機能 PR である `08` で行う）

## 対象外

- D1・R2 の実接続（`03` 以降）
- Docker Compose によるローカル起動（`02`）
- デザイントークンの実装（`04`）
- Cloudflare へのデプロイ設定そのもの（`docs/deploy.md`）

## 依存 PR

なし

## 変更・追加内容

- `package.json`、`tsconfig.json`、`biome.json`、`vitest.config.ts`、`wrangler.toml` の追加
- `next.config.ts`（OpenNext 前提の設定）の追加
- 最小限のトップページ（動作確認用）
- README への開発コマンド（`pnpm dev`、`pnpm lint`、`pnpm test` 等）の追記

## DB マイグレーション

なし

## 受け入れ条件

- `pnpm dev` で Next.js の開発サーバーが起動する
- `pnpm lint` / `pnpm format` が動作する
- `pnpm test` でサンプルの Vitest テストが実行できる
- Playwright のセットアップが完了し、サンプルシナリオ（トップページの表示確認など）が実行できる
- `pnpm build` の後、OpenNext のビルド（Cloudflare Workers 向け出力）が成功する
- CI 上で Lint・型チェック・テストが実行される
