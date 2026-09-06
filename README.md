# CANSHI

愛猫の日々の行動・健康状態・食事・通院などを記録する Web サービス。

詳細な仕様は [`docs/idea/index.md`](docs/idea/index.md)、実装計画は [`docs/plans/`](docs/plans/) を参照。

## 開発コマンド

```bash
pnpm install    # 依存パッケージのインストール
pnpm dev        # 開発サーバー起動（next dev）
pnpm lint       # Biome によるチェック
pnpm format     # Biome によるフォーマット（--write）
pnpm typecheck  # TypeScript の型チェック
pnpm test       # Vitest（単体・結合テスト）
pnpm test:watch # Vitest（watch モード）
pnpm e2e        # Playwright（E2E テスト）
pnpm build      # Next.js の本番ビルド
```

## Cloudflare Workers 向けビルド

`@opennextjs/cloudflare` を使用して Next.js のビルド出力を Cloudflare Workers 向けに変換する。

```bash
pnpm cf:build    # OpenNext ビルド（.open-next/ を生成）
pnpm cf:preview  # ビルド後、wrangler でローカルプレビュー
pnpm cf:deploy   # ビルド後、Cloudflare Workers へデプロイ
```

デプロイ手順の詳細は [`docs/deploy.md`](docs/deploy.md) を参照。

## ローカル開発環境（Docker Compose）

`docker compose up` のみで、D1・R2 のローカルエミュレーションを含めた開発環境を起動できる。

```bash
cp .env.example .env  # 初回のみ
docker compose up
```

- `http://localhost:3000` でアプリケーションにアクセスできる
- Next.js の開発サーバー（`next dev`）は `@opennextjs/cloudflare` の `initOpenNextCloudflareForDev()` により、
  `wrangler.toml` に定義した D1（`DB`）・R2（`MEDIA_BUCKET`）バインディングをローカルエミュレーションとして利用する
- ローカル D1・R2 のデータは `.wrangler/state/`（ホスト側にバインドマウント）に永続化され、
  `docker compose down` → `up` を繰り返してもデータが保持される
- ローカル環境は Cloudflare の実サービス（本番の D1・R2）には一切接続しない

```bash
docker compose down    # コンテナを停止
docker compose down -v # node_modules 用の名前付きボリュームも含めて破棄する場合
```

## ディレクトリ構成

- `src/app/` — Next.js App Router のページ・レイアウト
- `src/components/` — 共通 UI コンポーネント
- `src/features/` — 機能ごとのロジック・フォーム
- `src/db/` — DB スキーマ・マイグレーション（Drizzle ORM）
- `e2e/` — Playwright の E2E テスト
