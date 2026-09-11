# 15. Cloudflare Access 設定の確認・文書化

## 目的

MVP の最終 PR として、Cloudflare Workers 全体に設定済みの Cloudflare Access が CANSHI のすべての公開経路を保護していることを確認し、設定・運用・動作確認の手順を `docs/deploy.md` に文書化する。

Cloudflare Access はリクエストを Worker の実行前に評価するため、アプリケーション内で Access JWT を重ねて検証しない。アプリ内のユーザー管理・認可も実装しない。

## スコープ

- Cloudflare ダッシュボードで Workers 全体の Access が `All traffic` に設定されていることを確認する
- CANSHI のカスタムドメイン、`workers.dev`、プレビュー URL が同じ Access ポリシーで保護されていることを確認する
- Worker 単位またはホスト名・パス単位に、意図しない公開設定や Bypass ポリシーがないことを確認する
- 許可ユーザーの追加・削除と、Access の動作確認手順を `docs/deploy.md` に記載する

## 対象外

- アプリケーション内での Access JWT の解析・検証
- Access JWT 検証用の Team ドメイン・Audience タグの環境変数
- アプリ内のユーザー管理・認可（`docs/idea/index.md` の方針どおり実装しない）
- Access ポリシーや許可ユーザーの値をリポジトリで管理すること

## 依存 PR

- `01`（プロジェクト基盤構築）
- `02`（ローカル開発環境）

## 注意事項

Access の設定はリポジトリ外の Cloudflare ダッシュボードで管理される。Worker やドメインを追加したとき、および Access ポリシーを変更したときは、本計画の受け入れ条件を再確認すること。

Access はホスト名・パス単位、Worker 単位、アカウント内の Workers 全体の順に具体的な設定が優先される。Workers 全体を保護していても、より具体的な公開設定や Bypass ポリシーを追加すると、その経路が保護されない可能性がある。

## 変更・追加内容

- `docs/deploy.md` に現在の Access 設定と保護対象を記載する
- `docs/deploy.md` に許可ユーザーの運用手順と動作確認手順を記載する
- Access JWT のアプリ内検証を前提としていた計画書の記述を修正する
- アプリケーションコード、環境変数、シークレットは追加しない

## DB マイグレーション

なし

## 受け入れ条件

- Workers 全体の Access が `All traffic` に設定されている
- 許可対象のユーザーは CANSHI にアクセスでき、許可対象外のユーザーは Worker が実行される前に拒否される
- カスタムドメイン、`workers.dev`、プレビュー URL のすべてが Access で保護されている
- Worker 単位またはホスト名・パス単位に、意図しない公開設定や Bypass ポリシーがない
- 許可ユーザーの追加・削除方法と動作確認手順が `docs/deploy.md` に記載されている
- Access のためのアプリケーションコードや環境変数を追加せず、ローカル環境が従来どおり起動する
