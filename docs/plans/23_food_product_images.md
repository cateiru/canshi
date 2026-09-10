# 23. ごはん商品の画像

## 目的

ごはん商品マスタに商品画像を登録し、給餌記録のフォームや一覧で商品を画像で識別できるようにする。猫に紐付かないメディアの最初の対象となる。

## スコープ

- ごはん商品の新規作成・編集フォームへの `MediaAttachmentField` の組み込み（1 商品につき 1 枚。差し替え時は旧画像を削除する）
- `media_assets.cat_id` を NULL、`record_type` を `"food_product"` として保存する
- ごはん商品一覧・給餌記録フォームの商品選択・給餌プリセットの一覧でのサムネイル表示
- ごはん商品の削除時に画像を削除する

## 対象外

- 商品バーコードの読み取りや外部サイトからの画像取得
- 動画の添付

## 依存 PR

- `06`（ごはん商品マスタ）
- `07`（給餌記録）
- `19`（添付 UI 共通コンポーネント）

## 変更・追加内容

- `src/features/media/MediaAttachmentField.tsx` の 1 枚制限モード（`maxCount`）の追加
- `src/features/food-products/` のフォーム・アクション・クエリの更新
- `src/app/food-products/` の一覧ページの更新
- `src/features/feeding-records/FeedingRecordForm.tsx`・`src/features/feeding-presets/` の商品表示の更新

## DB マイグレーション

なし（`media_assets.cat_id` は `03` の時点で nullable）

## 受け入れ条件

- ごはん商品に画像を 1 枚登録・差し替え・削除できる
- 商品一覧・給餌記録フォーム・給餌プリセットで商品画像が表示される
- 商品を削除すると画像が削除される
