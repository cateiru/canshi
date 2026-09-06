# 02. ローカル開発環境（Docker Compose）

## 目的

`docker compose up` だけで、D1・R2 のローカルエミュレーションを含めた開発環境を起動できるようにする。

## スコープ

- `wrangler dev`（Miniflare）をコンテナ化し、D1・R2 のローカルエミュレーションを有効にする
- D1・R2 のローカルデータをホスト側にボリュームマウントし、コンテナ再作成後もデータを保持する
- Next.js の開発サーバー（`next dev`）とバックエンド（Workers 向け API）を同一コンテナ、もしくは compose 上の別サービスとして起動する構成を決定する
- 環境変数・シークレットのローカル用サンプルファイル（`.env.example` 等）を整備する
- 開発者向けドキュメント（`README.md` もしくは `docs/` 配下）に起動手順を追記する

## 対象外

- 本番・ステージング環境のデプロイ構成（`docs/deploy.md`）
- Cloudflare Access のローカル無効化以外のアクセス制御（`15`）

## 依存 PR

- `01`（プロジェクト基盤構築）

## 変更・追加内容

- `Dockerfile`（開発用）
- `docker-compose.yml`
  - Next.js dev サーバー
  - wrangler dev（D1・R2 ローカルエミュレーション有効）
  - ボリューム定義（`.wrangler/state` 等の永続化）
- `.env.example` の追加
- README への `docker compose up` 手順の追記

## DB マイグレーション

なし（`03` 以降のマイグレーションが、この環境上でも実行できることを確認する）

## 受け入れ条件

- `docker compose up` のみでアプリケーションが起動し、ブラウザから動作確認できる
- コンテナを再起動しても、ローカル D1・R2 のデータが保持される
- `docker compose down` → `docker compose up` を繰り返しても再現性がある
- ローカル環境が Cloudflare の実サービス（本番の D1・R2）に接続しないことを確認する
