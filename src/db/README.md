# DB 設計規約

Cloudflare D1（SQLite 互換）上で Drizzle ORM を使う際に、以降の全テーブルが従う共通規約をまとめる。

## マイグレーション運用フロー

- スキーマ定義は `src/db/schema/*.ts` に配置し、`src/db/schema/index.ts` からまとめて export する
- `pnpm db:generate`（`drizzle-kit generate`）でスキーマ定義から SQL マイグレーションファイルを `drizzle/` 配下に生成する
- 生成したマイグレーションは `pnpm db:migrate:local`（`wrangler d1 migrations apply DB --local`）でローカル D1 に適用する
  - 本番適用は `pnpm db:migrate:remote`（`--remote`）。実行タイミング・認証情報は `docs/deploy.md` を参照
- drizzle-kit 自身のマイグレーター（`drizzle-kit push` 等）は使わない。D1 はネットワーク越しの直接接続ができないため、`wrangler d1 migrations apply` に運用を統一する
- `wrangler.toml` の `[[d1_databases]].migrations_dir` を `drizzle` に設定し、drizzle-kit の出力先と wrangler の適用先を一致させている

## 共通カラム規約

- すべての記録テーブルは `cat_id`（`cats.id` への外部キー）を持つ
- すべての記録テーブルは、その記録を代表する発生日時（UTC の datetime、`integer` の unix タイムスタンプで保持）を 1 列持つ。列名はテーブルのドメインに合わせてよいが、どの列が代表の発生日時かを次の一覧で管理する。タイムライン機能（`14`）はこの一覧に従って各テーブルを集約する

  | テーブル             | 代表の発生日時列  |
  | -------------------- | ------------------ |
  | `feeding_records`    | `occurred_at`       |
  | `poop_records`       | `occurred_at`       |
  | `weight_records`     | `occurred_at`       |
  | `vomit_records`      | `occurred_at`       |
  | `symptoms`           | `onset_at`          |
  | `medication_doses`   | `occurred_at`       |
  | `hospital_visits`    | `visited_at`        |

  （`medications` 自体は予定・マスタ的な情報のため、タイムラインの対象は実績である `medication_doses` とする）

- 日付のみを表す列（生年月日・お迎え日など時刻を持たない情報）は `text` 型で ISO8601 の日付文字列（`YYYY-MM-DD`）として保持する
- 発生日時・作成日時・更新日時など時刻を持つ列は `integer("...", { mode: "timestamp" })`（unix タイムスタンプ）で保持する

## 画像・動画（`media_assets`）

- 画像・動画は個別の記録テーブルにカラムを持たせず、`media_assets` テーブルで一元管理する
- `recordType`（例: `"poop_record"`）+ `recordId` の polymorphic な組で対象レコードに紐付ける
- `catId` は猫に紐付かないメディア（ごはん商品画像など）を許容するため nullable
- MVP では書き込みロジックを実装せず、テーブル定義のみ用意する。実際の R2 連携・アップロード実装は第2段階以降の PR で行う

## AI 評価結果（`ai_evaluations`）

- AI 評価結果も個別の記録テーブルにカラムを持たせず、`ai_evaluations` テーブルで一元管理する
- `recordType` + `recordId` の polymorphic な組で対象レコードに紐付ける
- `model`・`promptVersion`・`aiOutput`・`evaluatedAt`・`userCorrection`（利用者による修正結果）・`mediaAssetId`（入力に使った画像・動画）を保存する
- MVP では AI 評価の呼び出しを実装せず、テーブル定義のみ用意する。実際の呼び出し実装は第3段階以降の PR で行う

## DB クライアント

- `src/db/client.ts` の `getDb()` で、Cloudflare bindings（`@opennextjs/cloudflare` の `getCloudflareContext()`）経由の D1 バインディングから Drizzle インスタンスを取得できる
- Server Actions・Route Handler からはこの `getDb()` を通して DB にアクセスする

## テストについて

- D1 バインディングは Vitest から直接扱えないため、単体テストでは `drizzle-orm/sql-js`（WASM 版 SQLite）を使い、`drizzle/` に生成済みのマイグレーションを適用したうえでスキーマ定義への型安全なクエリを検証する（`src/db/schema/cats.test.ts` を参照）
- ネイティブビルドが必要な `better-sqlite3` ではなく `sql.js` を採用しているのは、Docker コンテナ等ビルドツールチェーンを持たない環境でも追加設定なくテストを実行できるようにするため
