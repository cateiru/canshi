# CLAUDE.md

このファイルは Claude（および他の AI コーディングエージェント）がこのリポジトリで作業する際のガイドとして参照する。

## リリースノートの記載（必須）

ユーザーから見て意味のある変更（機能追加・仕様変更・不具合修正など）を行った場合は、
コミットに含める形で `src/features/release-notes/release-notes.json` に変更点を追記すること。
表示専用ページ（`/release-notes`）や内部リファクタリング・テストのみの変更など、
ユーザーに影響しない差分では追記不要。

追記の手順:

1. `src/features/release-notes/schema.ts` の `releaseNoteSchema` に従い、配列の先頭ではなく
   末尾に新しいエントリを追加する（表示順は `src/features/release-notes/data.ts` が日付で
   自動的に並べ替えるため、記載位置は問わない）。
2. 各フィールド:
   - `version`: `package.json` の `version` を更新した場合はその値。更新しない場合は、
     直近のエントリから適切にパッチ／マイナーバージョンを1つ上げた値。
   - `date`: 変更をコミットする日付（`YYYY-MM-DD`）。
   - `title`: 変更内容を要約する短い見出し。
   - `items`: ユーザー向けの変更点を日本語の箇条書きで1件以上。実装の詳細ではなく、
     ユーザーが体感できる変化を書く。
3. `pnpm test` で `src/features/release-notes/data.test.ts` が通ることを確認する
   （JSON がスキーマ違反だとここで失敗する）。

リリースノートは `/release-notes` ページ（トップページ「更新情報を見る」からも遷移可能）で
一覧表示される。

## その他

- 開発コマンド・ディレクトリ構成は [`README.md`](README.md) を参照。
- DB 設計規約は [`src/db/README.md`](src/db/README.md) を参照。
