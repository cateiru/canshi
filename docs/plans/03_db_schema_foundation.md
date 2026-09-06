# 03. DB スキーマ基盤・cats テーブル

## 目的

Cloudflare D1 上のマイグレーション基盤を整備し、以降の全レコードテーブルが従う共通規約と `cats` テーブルを実装する。

## スコープ

- Drizzle ORM + Drizzle Kit の導入
- `wrangler d1 migrations` と連携したマイグレーション運用フローの確立
- 以降のテーブルが共通で守る設計規約の確定（本 PR のドキュメント／コードコメントに明記する）
  - すべての記録テーブルは `cat_id`（`cats.id` への外部キー）を持つ
  - すべての記録テーブルは、その記録を代表する発生日時（UTC の datetime）を 1 列持つ。列名は各テーブルのドメインに合わせてよいが（例：症状記録の `onset_at`、通院記録の `visited_at`）、どの列が代表の発生日時かを本 PR の一覧で管理し、タイムライン機能（`14`）はこの一覧に従って集約する
    - `feeding_records.occurred_at`
    - `poop_records.occurred_at`
    - `weight_records.occurred_at`
    - `vomit_records.occurred_at`
    - `symptoms.onset_at`
    - `medication_doses.occurred_at`（`medications` 自体は予定・マスタ的な情報のためタイムラインの対象は実績である `medication_doses` とする）
    - `hospital_visits.visited_at`
  - 画像・動画は正規化した `media_assets` テーブルで一元管理する（polymorphic な `record_type` + `record_id` で対象レコードに紐付け、R2 オブジェクトキーとサムネイルのオブジェクトキーを保持）。個別の記録テーブルに画像カラムを持たせない
  - AI 評価結果は正規化した `ai_evaluations` テーブルで一元管理する（`record_type` + `record_id` で対象レコードに紐付け）
- `cats` テーブルの実装（名前、性別、生年月日、猫種、お迎え日）
- `media_assets` テーブル、`ai_evaluations` テーブルの実装（MVP では書き込みロジックを実装せず、テーブル定義のみ用意する）

## 対象外

- `cats` の CRUD API・UI（`05`）
- 画像アップロード・R2 連携の実装（第2段階）
- AI 評価の呼び出し実装（第3段階）
- 記録テーブル本体（`06` 以降で各 PR ごとに追加）

## 依存 PR

- `01`（プロジェクト基盤構築）

## 変更・追加内容

- `src/db/schema/cats.ts`、`src/db/schema/media-assets.ts`、`src/db/schema/ai-evaluations.ts`
- Drizzle Kit の設定ファイル、マイグレーション生成スクリプト
- 設計規約をまとめた `src/db/README.md`（もしくは同等のドキュメント）

## DB マイグレーション

- `cats` テーブルを新規作成
  - `id`、`name`、`sex`、`birth_date`（nullable）、`breed`（nullable）、`adopted_at`（nullable）、`created_at`、`updated_at`
- `media_assets` テーブルを新規作成
  - `id`、`cat_id`（nullable。ごはん商品画像など猫に紐付かないメディアを許容するため）、`record_type`、`record_id`、`object_key`、`thumbnail_object_key`（nullable）、`mime_type`、`created_at`
- `ai_evaluations` テーブルを新規作成
  - `id`、`record_type`、`record_id`、`model`、`prompt_version`、`ai_output`（JSON）、`evaluated_at`、`user_correction`（JSON、nullable）、`media_asset_id`（nullable）、`created_at`

## 受け入れ条件

- `wrangler d1 migrations apply` によりローカル D1（`02` の Docker Compose 環境）にマイグレーションが適用できる
- Drizzle のスキーマ定義から型安全にクエリを発行できることを、サンプルの単体テストで確認する
- 設計規約（`cat_id`・`occurred_at`・`media_assets`・`ai_evaluations` の使い方）がドキュメント化されている
