# 32. MCP 対応・OIDC 認証 概要

CANSHI の記録を ChatGPT などの外部 AI エージェントから参照・操作できるようにするため、
MCP（Model Context Protocol）サーバーを追加し、その認証に OIDC／OAuth を導入する構想の
概要を記載する。PR 単位への詳細分割は別途行う（`33` 以降を想定。「PR 分割案」参照）。

## 背景・目的

- `docs/idea/index.md` の方針どおり、CANSHI は現在アプリ内のユーザー管理・認可を実装せず、
  Cloudflare Workers 全体を Cloudflare Access（`All traffic`）で保護している
  （`docs/plans/15_cloudflare_access.md`、`docs/deploy.md`）
- 今回追加したいのは、ChatGPT のような AI エージェントが CANSHI の記録（タイムライン・猫の
  プロフィールなど）を読み書きできる MCP サーバー。ChatGPT のカスタムコネクタ（Developer
  Mode）から接続できることを目標とする
- MCP のクライアント（ChatGPT のバックエンド）はブラウザを介さないサーバー間通信であり、
  Cloudflare Access の `All traffic` ポリシーが前提とするブラウザリダイレクト／Cookie による
  ログインを完了できない。そのため MCP 用の経路には、MCP 仕様が要求する OAuth 2.1 ベースの
  認可フローを別途用意する必要がある
- ユーザーからは「OIDC は Cloudflare が使えるなら使いたい」という要望があるため、新規の外部
  ID プロバイダーを導入せず、Cloudflare のエコシステム（Access・Workers）内で完結する構成を
  優先的に検討する

## 対象機能（このドキュメントで検討する範囲）

- Cloudflare Workers 上で動く MCP サーバー本体（Streamable HTTP トランスポート）
- MCP サーバー向けの OAuth 2.1 認可サーバー（トークン発行・検証）
- 認可サーバーの upstream ID プロバイダーとしての Cloudflare Access の利用可否
- ChatGPT のカスタムコネクタ（Developer Mode）から接続する際の要件整理
- 上記を踏まえた、Cloudflare Access の `All traffic` ポリシーとの共存方法

## 対象外

- MCP で公開する個々のツールの詳細スキーマ・実装（`34` 以降で検討）
- ChatGPT 以外の MCP クライアント（Claude Desktop 等）への対応（将来検討、今回は考慮のみ）
- 書き込み系ツール（記録の追加・編集）の可否判断（「未決定事項」に記載し、着手前に別途判断）
- Cloudflare Access のダッシュボード設定作業そのもの（手順は `docs/deploy.md` に追記するが、
  設定変更の実行はリポジトリ外の運用作業）

## 認証アーキテクチャの検討

### 案A: MCP の経路も含め、Cloudflare Access の `All traffic` でそのまま保護する

- ChatGPT のコネクタはサーバー間通信でありブラウザログインを完了できないため、Access の
  ポリシーをそのまま適用すると MCP からのリクエストが到達前に拒否される
- Access の Service Token（`CF-Access-Client-Id`/`CF-Access-Client-Secret`）で回避する手も
  あるが、ChatGPT のコネクタ設定は OAuth かベアラートークンの指定に限られ、固定ヘッダーの
  付与には対応していない。また MCP 仕様が要求する認可サーバーメタデータの discovery や
  トークンエンドポイントとも整合しない
- → 却下。MCP 用の経路には別の認証レイヤーが必要

### 案B（採用）: MCP 用の経路だけ Access の全面保護から切り出し、`@cloudflare/workers-oauth-provider` で OAuth 2.1 認可サーバーを実装。ログイン自体は Cloudflare Access に委譲する

- `@cloudflare/workers-oauth-provider` は Cloudflare Workers 上で OAuth 2.1 準拠の認可サーバー
  （および保護リソースサーバー）を実装するための公式ライブラリ。GitHub や Google などの
  upstream IdP と組み合わせて「ユーザーがサインインし、MCP クライアントに権限を付与する」
  フローを構築する用途で Cloudflare 自身が MCP サーバーの認証手段として案内している
- ただしこのライブラリ自体は IdP ではなく、実際のユーザー認証・同意画面はアプリ側で実装する
  設計。そこで `/authorize` の実装内で Cloudflare Access によるログイン（既存の Access ポリシー
  で許可されている家族のメンバーのみ）を経由させ、ログイン後にライブラリの仕組みで MCP
  クライアント用のトークンを発行する
- 同様の考え方（Cloudflare Access を OIDC の ID ソースとして使い、Workers 側でトークンを
  発行する）は社外 OSS（`eidam/cf-access-workers-oidc`）でも実装例があり、実現性の裏付けとする
- Access 側は「All traffic」のポリシーのうち、MCP 用のパス（例: `/mcp`, `/oauth/*`）だけ、
  ログイン画面（`/oauth/authorize` 等の対話的な遷移）は Access 保護を残しつつ、トークン
  エンドポイントと MCP 本体の JSON-RPC 呼び出し（ChatGPT のバックエンドから直接叩かれる経路）
  は Access の全面保護から除外する設定変更が必要になる。この変更は Cloudflare ダッシュボード
  側の作業であり、影響範囲を最小化する具体策は「未決定事項」を参照
- Cloudflare のエコシステム内（Access・Workers）で完結でき、新規の外部サービス・アカウントが
  不要な点で、後述の案 C より要望に合致する

### 案C: 外部の専用 ID プロバイダー（Auth0・WorkOS・Stytch など）を新規導入する

- MCP サーバーに OAuth を追加する事例として広く使われている構成ではあるが、新たな外部
  サービスへのアカウント登録・シークレット管理が増える
- `docs/idea/index.md` の「個人・家庭内で使う前提」「アプリ内ユーザー管理・認可は実装しない」
  という既存方針から外れ、Cloudflare だけで完結させたいという要望にも合わない
- → 保留。案 B が実現できない事情が判明した場合の代替案として記録するのみ

### 結論（暫定）

案 B を採用する。Cloudflare Access を唯一の ID ソースとして維持したまま、MCP 専用の経路にだけ
`@cloudflare/workers-oauth-provider` ベースの OAuth 2.1 レイヤーを追加する。

## クライアント登録方式の検討

- MCP の最新仕様では、認可サーバーが対応していれば Client ID Metadata Document（CIMD、HTTPS
  URL を `client_id` として使う方式）が新規実装で推奨されている。ChatGPT はこの CIMD（公開
  クライアントまたは `private_key_jwt` によるクライアント認証）に対応している
- 従来の Dynamic Client Registration（RFC 7591）は互換性維持のための位置づけになっているが、
  `@cloudflare/workers-oauth-provider` は RFC 7591 の DCR エンドポイントに対応済み
- CANSHI は個人・家庭内利用で、接続する MCP クライアントは当面 ChatGPT 1 系統のみを想定する
  ため、DCR・CIMD のどちらでも実用上の支障はない。まずライブラリが標準対応する DCR で実装し、
  CIMD への追従はライブラリ側の対応状況を見て判断する

## 決定事項（暫定。着手前に異論があれば変更可）

- MCP サーバーは Cloudflare Workers 上に実装し、トランスポートは Streamable HTTP を使う
- 認可サーバーの実装には `@cloudflare/workers-oauth-provider` を使う
- upstream の ID プロバイダーとして Cloudflare Access を使い、新規の外部 IdP は導入しない
- クライアント登録は当面 DCR（`workers-oauth-provider` の標準対応）を使う
- 最初に公開する MCP ツールは読み取り専用（猫のプロフィール参照、タイムライン参照など）から
  始め、書き込み系ツールは別 PR で改めて検討する
- Cloudflare Access 側の設定変更（MCP 用パスの除外）はコードの PR とは別に運用作業として行い、
  手順を `docs/deploy.md` に追記する

## 未決定事項（着手前に確認）

- MCP で公開する具体的なツール一覧・入出力スキーマ・スコープ設計
- OAuth のクライアント情報・認可コード・トークンの永続化先（`workers-oauth-provider` の標準
  ストレージが前提とするバインディングの種類を確認し、必要なら新規の Cloudflare リソース
  （例: KV Namespace）を追加する。現状の `wrangler.toml` には D1・R2 のみで KV は未導入）
- 書き込み系ツールを提供するかどうか、提供する場合に破壊的操作（削除など）への確認フローを
  どう設けるか
- Cloudflare Access の `All traffic` から MCP 用パスを除外する際の具体的なポリシー設計と、
  除外範囲を最小限に保つための検証手順
- MCP サーバー・OAuth エンドポイントに対するレート制限・不正利用防止の要否
- ChatGPT 以外の MCP クライアントへの対応要否（今回はスコープ外だが、方針だけ確認しておく）

## PR 分割案

- `33` MCP 用 OAuth 基盤（`@cloudflare/workers-oauth-provider` 導入、Cloudflare Access を
  upstream にした `/authorize` 実装、トークン発行・保存先の追加）
- `34` MCP サーバー本体・読み取り専用ツール（猫プロフィール・タイムライン参照）
- `35` ChatGPT カスタムコネクタでの接続確認・`docs/deploy.md` への設定手順追記
  （Cloudflare Access のパス除外設定を含む）
- （将来）書き込み系ツールの追加 PR

## 参考資料

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [cloudflare/workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider)
- [Cloudflare Agents: Build a Remote MCP server](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/)
- [Cloudflare Agents: MCP Authorization](https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/)
- [Cloudflare Blog: The next generation of MCP](https://blog.cloudflare.com/mcp-v2/)
- [Cloudflare One: Generic OIDC](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/generic-oidc/)
- [Cloudflare One: SaaS applications（OIDC/SAML での SSO 提供）](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/saas-apps)
- [eidam/cf-access-workers-oidc（Cloudflare Access を OIDC provider 化する社外 OSS の実装例）](https://github.com/eidam/cf-access-workers-oidc)
- [OpenAI: Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
- [OpenAI: Building MCP servers for plugins and API integrations](https://developers.openai.com/api/docs/mcp)
