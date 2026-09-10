# デプロイ

CANSHI の Cloudflare 環境へのデプロイ手順・運用設定をまとめる。`docs/plans/` の実装計画には含めず、本ファイルに集約する。

## 前提

- ホスティング：Cloudflare Workers
- ビルド：`@opennextjs/cloudflare` で `next build` の出力を Workers 向けに変換する
- DB：Cloudflare D1
- オブジェクトストレージ：Cloudflare R2（写真・動画の本体は非公開バケットに保存）
- バックグラウンド処理：Cloudflare Workflows（定期通知のスケジュール実行）
- 認証・外部アクセス制御：Cloudflare Access（アプリ内のユーザー管理・認可は実装しない）

## 必要な Cloudflare リソース

- Workers（アプリ本体）
- D1 データベース（本番・ステージング用に分離するかは要検討）
- R2 バケット
  - メディア（写真・動画）用バケット（非公開）
  - ISR・SSG のキャッシュ用バケット（メディア用とは分離する。`docs/idea/index.md` の方針）
- Cloudflare Access のアプリケーション設定（対象ドメイン、許可ポリシー）
- Cloudflare Workflows（定期通知が実装される第2段階以降で必要）

## 環境変数・シークレット

`docs/plans/01_project_setup.md` で用意する `.env.example` を基準に、本番用の値を Cloudflare のシークレット管理（`wrangler secret put` 等）で設定する。

- D1・R2 のバインディング名（`wrangler.toml` で定義）
- Cloudflare Access の Team ドメイン・Audience タグ（`docs/plans/15_cloudflare_access.md` 参照）
- OpenAI API キー（第3段階の AI 機能実装時に追加）

## デプロイ手順（TODO）

未着手の検討事項。着手前に内容を確定させる。

- Cloudflare アカウント・ゾーンの準備
- `wrangler.toml` の本番向け設定（D1・R2 バインディング、ルート設定）
- CI（GitHub Actions）からの `wrangler deploy` 自動化の要否・方法
- ステージング環境を用意するかどうか
- マイグレーション（`wrangler d1 migrations apply`）の本番適用フロー

## Cloudflare Access 設定

対象ドメイン・アプリケーションの登録と許可ユーザーのポリシーは Cloudflare ダッシュボードで設定済み（2026-09 時点）。以下は未整理。

- 許可するユーザー（メールアドレス等）の追加・削除の運用方法
- `docs/plans/15_cloudflare_access.md` で実装する JWT 検証に必要な Team ドメイン・Audience タグの控え

## 監視・運用（TODO）

- エラー監視・ログの方針
- D1・R2 の利用量・コストの監視
- バックアップ方針（D1・R2）

## 備考

本ファイルは実装の進行に合わせて更新する。各 TODO は該当する実装 PR（`docs/plans/`）に着手する前に内容を確定させること。
