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

## Web Push（通知）

生成された通知（`28`）を Web Push で端末に届ける仕組み。詳細は [`docs/plans/29_web_push.md`](docs/plans/29_web_push.md) と [`docs/deploy.md`](docs/deploy.md) を参照。

```bash
pnpm vapid:generate  # VAPID 鍵ペアを生成する（デプロイ環境ごとに1回）
```

ローカルで通知の生成〜Push 送信までの一連の流れ（`src/workflows/notification.ts`）を確認するには、`wrangler dev` の `scheduled` ハンドラを手動起動する。

```bash
pnpm cf:build   # .open-next/worker.js を生成（worker.ts がこれを import するため必要）
npx wrangler dev --test-scheduled
# 別ターミナルで
curl "http://localhost:8787/__scheduled?cron=*/15+*+*+*+*"
```

VAPID 鍵（`.dev.vars`）が未設定の場合は通知の生成だけ行われ、Push 送信はスキップされる。

## ローカル開発環境（Docker Compose）

`docker compose up` のみで、D1・R2 のローカルエミュレーションを含めた開発環境を起動できる。

```bash
docker compose up
```

- `http://localhost:3000` でアプリケーションにアクセスできる
- シークレット等が必要になった場合は `.env.example` を `.env` にコピーして使う（`docker-compose.yml` は `.env` の有無にかかわらず動作する）
- Next.js の開発サーバー（`next dev`）は `@opennextjs/cloudflare` の `initOpenNextCloudflareForDev()` により、
  `wrangler.toml` に定義した D1（`DB`）・R2（`MEDIA_BUCKET`）バインディングをローカルエミュレーションとして利用する
- ローカル D1・R2 のデータは `.wrangler/state/`（ホスト側にバインドマウント）に永続化され、
  `docker compose down` → `up` を繰り返してもデータが保持される
- ローカル環境は Cloudflare の実サービス（本番の D1・R2）には一切接続しない

```bash
docker compose down    # コンテナを停止
docker compose down -v # node_modules 用の名前付きボリュームも含めて破棄する場合
```

## DB（Drizzle ORM + Cloudflare D1）

```bash
pnpm db:generate      # スキーマ定義（src/db/schema/）から SQL マイグレーションを生成
pnpm db:migrate:local # ローカル D1 にマイグレーションを適用
pnpm db:migrate:remote # 本番 D1 にマイグレーションを適用（docs/deploy.md 参照）
```

設計規約（`cat_id`・発生日時列・`media_assets`・`ai_evaluations` の使い方）は [`src/db/README.md`](src/db/README.md) を参照。

## PWA

ホーム画面に追加してインストールできる PWA として動作する。

アイコンは `public/icons/icon.svg` を原本とする。変更後に `pnpm icons:generate` を実行すると、ブラウザ用の SVG・ICO（16・32・48px）、PWA 用の PNG（192・512px）、Apple touch icon（180px）をまとめて再生成できる。maskable 版は猫全体がセーフエリア内に収まる余白を取り、Apple 用は OS が角を丸めるため背景を全面に描画する。

- Service Worker（`public/sw.js`）は本番ビルドでのみ登録される（`next dev` では HMR と競合するため登録しない）
- キャッシュ対象は静的アセット（`/_next/static/`）とオフライン時のフォールバックページ（`/offline`）のみで、記録データを含むページ・API はキャッシュしない
- キャッシュの構成を変更した場合は `public/sw.js` の `CACHE_VERSION` を上げること（`activate` 時に古いバージョンのキャッシュを破棄する）

インストール可能であることを確認する手順は以下の通り。

```bash
pnpm cf:preview  # OpenNext ビルド後、wrangler でローカルプレビューを起動
```

1. Chrome で `pnpm cf:preview` が出力する URL を開く
2. DevTools の Application タブ → Manifest で `Installability`（インストール可能かどうか）に警告が出ていないことを確認する
   - Lighthouse に「PWA」カテゴリがある場合はそちらの監査を実行し、「インストール可能」の項目が満たされていることを確認してもよい（バージョンによってはカテゴリ自体が存在しない）
3. アドレスバーのインストールアイコン（またはメニューの「アプリをインストール」）から実際にインストールし、standalone で起動することを確認する

## ディレクトリ構成

- `src/app/` — Next.js App Router のページ・レイアウト
- `src/components/` — 共通 UI コンポーネント
- `src/features/` — 機能ごとのロジック・フォーム
- `src/db/` — DB スキーマ・マイグレーション（Drizzle ORM）
- `e2e/` — Playwright の E2E テスト
