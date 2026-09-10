# 22. 愛猫の体の写真とプロフィール画像

## 目的

猫の体の写真を記録として残し、最新の写真からプロフィール用サムネイルを自動更新する。

## スコープ

- `cat_photos` テーブル（撮影日時・備考を持つ記録テーブル）と `src/app/cats/[catId]/photos/` 配下のページ（一覧・新規作成・編集）
  - 1 レコードにつき複数枚の写真を添付できる（`media_assets` の `record_type` は `"cat_photo"`）
- 猫詳細ページ・猫一覧ページのプロフィール画像表示
  - `cats.profile_media_asset_id` を追加し、写真を追加するたびに最新の写真のサムネイルで自動更新する（`docs/idea/index.md` の「写真からサムネイルを自動更新」）
  - 利用者が任意の写真をプロフィール画像として固定できるようにする（固定中は自動更新しない）
- 猫一覧・猫詳細のレイアウトへのプロフィール画像の組み込み（`04` の `CatEarFrame` を利用）
- タイムラインへの写真記録の追加（`03` の発生日時列の対応表に `cat_photos.taken_at` を追加する）
- 猫の削除時に、その猫に紐付くすべての `media_assets`（`cat_id` で検索）を削除する

## 対象外

- AI による体の特徴の補助分類（第3段階、`17`）
- 写真のアルバム的な整理（タグ・フォルダなど）

## 依存 PR

- `05`（猫プロフィール）
- `14`（タイムライン）
- `19`（添付 UI 共通コンポーネント）

## 変更・追加内容

- `src/db/schema/cat-photos.ts`
- `src/db/schema/cats.ts` へのカラム追加
- `src/app/cats/[catId]/photos/` 配下のページ
- `src/features/cat-photos/`
- `src/features/cats/` の一覧・詳細・削除アクションの更新
- `src/features/timeline/` の更新
- `src/db/README.md` の発生日時列の対応表の更新

## DB マイグレーション

- `cat_photos` テーブルを新規作成
  - `id`、`cat_id`、`taken_at`、`memo`、`created_at`、`updated_at`
- `cats` テーブルにカラムを追加
  - `profile_media_asset_id`（`media_assets.id` への外部キー、nullable）
  - `is_profile_pinned`（`boolean`、NOT NULL、既定値 false）：プロフィール画像を固定しているか

## 受け入れ条件

- 猫の写真を撮影日時とともに登録・編集・削除できる
- 写真を追加すると猫一覧・詳細のプロフィール画像が最新の写真に更新される
- プロフィール画像を任意の写真に固定でき、固定中は自動更新されない
- タイムラインに写真記録が表示される
- 猫を削除するとその猫の写真がすべて削除される
