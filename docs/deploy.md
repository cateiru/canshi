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
- Cloudflare Workers 全体の Access 設定と許可ポリシー
- Cloudflare Workflows（定期通知が実装される第2段階以降で必要）

## 環境変数・シークレット

`docs/plans/01_project_setup.md` で用意する `.env.example` を基準に、本番用の値を Cloudflare のシークレット管理（`wrangler secret put` 等）で設定する。

- D1・R2 のバインディング名（`wrangler.toml` で定義）
- OpenAI API キー（第3段階の AI 機能実装時に追加）

## デプロイ手順（TODO）

未着手の検討事項。着手前に内容を確定させる。

- Cloudflare アカウント・ゾーンの準備
- `wrangler.toml` の本番向け設定（D1・R2 バインディング、ルート設定）
- CI（GitHub Actions）からの `wrangler deploy` 自動化の要否・方法
- ステージング環境を用意するかどうか
- マイグレーション（`wrangler d1 migrations apply`）の本番適用フロー

## R2 バケット（メディア）

写真・動画の本体とサムネイルは `wrangler.toml` の `[[r2_buckets]]`（バインディング名 `MEDIA_BUCKET`、バケット名 `canshi-media`）に保存する。ローカル開発では Miniflare が `.wrangler/state` 配下にエミュレートするため、バケットの作成は不要。

### 本番バケットの作成

```sh
wrangler r2 bucket create canshi-media
```

- バケットは非公開のまま運用する（パブリックアクセス・カスタムドメインは設定しない）。配信はアプリの `GET /media/[assetId]` 経由で行い、Cloudflare Access で保護する
- オブジェクトキーは `{recordType}/{recordId}/{assetId}`（元データ）と `{recordType}/{recordId}/{assetId}.thumb.webp`（サムネイル）

### 上限値

1 ファイルあたりの上限と合計の保存容量は環境変数で上書きできる（既定値は画像 10 MB／動画 100 MB／合計 10 GB）。`wrangler.toml` の `[vars]` またはダッシュボードで設定する。

```toml
[vars]
MEDIA_MAX_IMAGE_BYTES = "10485760"
MEDIA_MAX_VIDEO_BYTES = "104857600"
MEDIA_STORAGE_LIMIT_BYTES = "10737418240"
```

- 合計容量は `media_assets.size_bytes` と `thumbnail_size_bytes` の合計で判定する。R2 の実使用量とは独立した値のため、R2 側のオブジェクトを直接操作した場合はずれる
- Workers のメモリ上限（128 MB）の都合上、動画の上限を 100 MB より大きくすることは推奨しない。アップロード時にリクエスト本体をメモリに展開するため、大きすぎる値はメモリ不足で失敗する
- サムネイル生成（WASM）は CPU 時間を消費する。Workers Free プランの CPU 時間上限（10 ms／リクエスト）では処理が失敗しうるため、Paid プランを前提とする
- Workers はメモリ上限（128 MB）の都合上、元画像をデコードしない。ブラウザが長辺 1024px に縮小したサムネイル候補だけをデコードし、候補がない場合は 4 MP（`MAX_DECODE_PIXELS`）以下の画像に限って Workers 側でサムネイルを生成する。それより大きい画像は「画像が大きすぎるためサムネイルを作成できませんでした」として拒否する

### 容量の監視

- ダッシュボードの R2 ページでバケットの使用量を確認する。R2 の無料枠（10 GB／月）を超えないよう、`MEDIA_STORAGE_LIMIT_BYTES` は無料枠以下に保つ
- 記録・猫の削除時にアプリが R2 のオブジェクトも削除するが、R2 の削除だけ失敗した場合は `media_assets` 行が残る（再度削除すれば片付く）。行の削除後に R2 側だけ残る孤立オブジェクトは発生しない設計だが、念のため定期的に `wrangler r2 object list` 等で確認する

## Cloudflare Access 設定

Cloudflare ダッシュボードの Workers & Pages で、Workers 全体を保護する設定を `All traffic` として設定済み（2026-09 時点）。この設定により、既存・新規 Worker の本番 URL とプレビュー URL へのリクエストは、Worker が実行される前に Access で評価される。

CANSHI はこのエッジでの保護を利用する。アプリケーション内で `Cf-Access-Jwt-Assertion` を検証する処理や、そのための Team ドメイン・Audience タグの環境変数は不要。

### 設定の確認

1. Cloudflare ダッシュボードの Workers & Pages を開く。
2. Overview の **Protect all Workers** で、保護対象が **All traffic** になっていることを確認する。
3. 適用されている Access ポリシーが、意図したユーザーまたはグループだけを許可していることを確認する。
4. Workers & Pages から CANSHI の Worker を開き、Worker 単位で公開設定や Bypass ポリシーが追加されていないことを確認する。
5. Zero Trust の Access controls > Applications で、CANSHI のホスト名・パスに対する、意図しない公開設定や Bypass ポリシーがないことを確認する。

Access の設定は、ホスト名・パス単位、Worker 単位、Workers 全体の順に具体的なものが優先される。Workers 全体を保護していても、より具体的な設定で公開するとその経路が保護されないため、設定変更時は手順 4・5 も確認する。

### 許可ユーザーの追加・削除

1. Zero Trust の Access controls > Policies を開く。
2. Workers 全体の Access に適用している再利用可能なポリシーを開く。
3. Include ルールのメールアドレスまたはグループを更新して保存する。
4. 次の動作確認を実施する。

許可対象の具体的なメールアドレスやグループは機密性のある運用情報として扱い、リポジトリには記載しない。

### 動作確認

- ログアウト状態または許可対象外のアカウントで、カスタムドメイン、`workers.dev`、プレビュー URL を開き、Access のログイン画面または拒否画面が表示されることを確認する
- 許可対象のアカウントで認証し、同じ URL から CANSHI を利用できることを確認する
- Worker や公開経路を追加したとき、および Access ポリシーを変更したときは再確認する

詳細は [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) と [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/) を参照する。

## Web Push（VAPID 鍵）

`29` の Web Push 送信（`src/features/push/`）に使う VAPID 鍵ペアは、デプロイ環境ごとに1回生成する。

```sh
pnpm vapid:generate
```

出力される2つの値の扱いが異なる点に注意する。

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`：クライアント（`PushSubscriptionToggle`）に埋め込まれるため、**ビルド時**に読める場所（`pnpm cf:build` を実行する環境の `.env.production.local` や CI の環境変数）に設定する必要がある。あわせて実行時（`src/workflows/notification.ts` が Push 送信に使う）にも必要なので、`wrangler secret put` でも設定する
- `VAPID_PRIVATE_KEY`：サーバー側だけで使う秘密鍵。`wrangler secret put` で設定する（クライアントに公開してはいけない）
- `VAPID_SUBJECT`：RFC 8292 が要求する連絡先（`mailto:` の管理者アドレスなど）。`wrangler secret put` で設定する

```sh
wrangler secret put NEXT_PUBLIC_VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_SUBJECT
```

いずれかが未設定の環境では、通知の生成（`28`）は動作するが Push 送信は自動的にスキップされる（`getVapidKeys` が `null` を返す）。

ローカル開発では `.dev.vars`（Git 管理対象外）に同じ3つを設定する。`NEXT_PUBLIC_VAPID_PUBLIC_KEY` は `next dev`／`next build` のビルド時読み込み用に `.env` にも追記する（`.env.example` 参照）。

### エントリポイントと定期実行

`wrangler.toml` の `main` は `.open-next/worker.js` を直接ではなく、それをラップするカスタムエントリポイント `worker.ts`（リポジトリルート）を指す。`worker.ts` は OpenNext の `fetch` ハンドラに加えて `scheduled`（`[triggers] crons`、15分ごと）と `NotificationWorkflow`（`[[workflows]]`）を export する。デプロイ後、cron トリガーが実際に有効になるまで最大15分のグローバル伝播遅延がある。

ローカルでの動作確認手順は [`README.md`](../README.md#web-push通知) を参照。

## 監視・運用（TODO）

- エラー監視・ログの方針
- D1・R2 の利用量・コストの監視
- バックアップ方針（D1・R2）

## 備考

本ファイルは実装の進行に合わせて更新する。各 TODO は該当する実装 PR（`docs/plans/`）に着手する前に内容を確定させること。
