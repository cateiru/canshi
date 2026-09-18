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

- MCP サーバー本体（Streamable HTTP トランスポート）を、メインアプリの Worker とは別の
  Cloudflare Workers として新設するかどうか
- MCP サーバー向けの OAuth 2.1 認可サーバー（トークン発行・検証）
- 認可サーバーの upstream ID プロバイダーとしての Cloudflare Access の利用可否
- ChatGPT のカスタムコネクタ（Developer Mode）から接続する際の要件整理
- MCP 用 Worker からメインアプリのデータ（D1）へのアクセス方法
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

### 案B: 既存の Worker の中で、MCP 用のパスだけ Access の全面保護から切り出す

- `@cloudflare/workers-oauth-provider` で OAuth 2.1 認可サーバーを実装し、`/authorize` の
  実装内で Cloudflare Access によるログインを経由させる、という認証の考え方自体は案 C と共通
- ただし同じ Worker・同じホスト名の中で「このパスだけ Access 対象外」という除外を作ることに
  なるため、Access 側のポリシー設定を誤ると意図せず他の経路まで保護対象から外れるリスクが
  ある。Cloudflare Access はホスト名・パス単位、Worker 単位、アカウント全体の順に、より
  具体的な設定が優先される仕組みのため（`docs/plans/15_cloudflare_access.md` 参照）、
  既存の `All traffic` 設定に対する例外は慎重な検証が必要になる
- → 不採用。同じ効果を、より安全な形（案 C）で実現できるため

### 案C（採用）: MCP 専用の新しい Cloudflare Workers を用意し、そちらだけ OAuth 2.1 で保護する

- メインアプリ（Next.js／OpenNext）の Worker とは別に、MCP サーバー・OAuth 認可サーバー専用の
  新しい Worker を用意する。別ホスト名（例: `mcp.canshi.example` のようなサブドメイン）で
  公開し、`@cloudflare/workers-oauth-provider` による OAuth 2.1 保護のみをそのホストにかける
- メインアプリの Worker・Access ポリシー（`All traffic`）には一切手を加えない。既存の
  ホスト名・ルートは今までどおり Access で保護されたままになり、案 B で懸念していた
  「既存ポリシーへの例外追加による事故」を構造的に避けられる
- ログインの実体（誰が MCP の利用を許可されているか）は、引き続き Cloudflare Access に委譲
  する。MCP 用 Worker の `/authorize` 実装から Cloudflare Access のログイン画面へリダイレクト
  させ、ログイン後に `@cloudflare/workers-oauth-provider` が MCP クライアント（ChatGPT）用の
  トークンを発行する流れは案 B と同じ。upstream IdP としての Cloudflare Access の使い方は
  変わらない
- MCP 用 Worker からメインアプリのデータ（D1 上の猫プロフィール・記録）へアクセスする方法は
  次の 2 通りが考えられる
  - **Service Bindings 経由でメインアプリの Worker を呼び出す（推奨）**：Cloudflare の
    Service Bindings は公開 URL・DNS を経由しない Worker 間の直接呼び出しで、Access を含む
    ゾーンの保護機構を通過しない（同一アカウント内の内部呼び出しのため、そもそも Access の
    対象にならない）。D1 へのクエリロジックをメインアプリ側に集約でき、MCP 用 Worker は
    「MCP プロトコル ⇄ 内部 RPC 呼び出し」の薄い変換層にできる。ただし、呼び出し先の RPC
    メソッドがどのユーザー・スコープからの呼び出しかを判定する情報は Access のコンテキストと
    して自動伝播されないため、MCP 用 Worker 側で認可済みであることを前提にした呼び出しになる
    （＝ MCP 用 Worker 内の OAuth 検証を通過したリクエストだけがこの RPC を呼べるようにする）
  - D1 データベースを MCP 用 Worker にも直接バインドする：クエリロジックが 2 箇所に重複する
    ため、保守性の観点で Service Bindings 案より劣る
- デメリットは、新しい Worker・サブドメイン・デプロイパイプラインが増える運用コスト。ただし
  個人・家庭内規模のアプリでは大きな負担ではなく、「MCP 用の変更がメインアプリの可用性・
  セキュリティ設定に影響しない」という分離のメリットの方が大きいと判断する

### 案D: 外部の専用 ID プロバイダー（Auth0・WorkOS・Stytch など）を新規導入する

- MCP サーバーに OAuth を追加する事例として広く使われている構成ではあるが、新たな外部
  サービスへのアカウント登録・シークレット管理が増える
- `docs/idea/index.md` の「個人・家庭内で使う前提」「アプリ内ユーザー管理・認可は実装しない」
  という既存方針から外れ、Cloudflare だけで完結させたいという要望にも合わない
- → 保留。案 C が実現できない事情が判明した場合の代替案として記録するのみ

### 結論（暫定）

案 C を採用する。MCP サーバー・OAuth 認可サーバーはメインアプリとは別の Cloudflare Workers
として新設し、upstream の ID ソースには引き続き Cloudflare Access を使う。メインアプリの
Worker・Access ポリシーには変更を加えない。

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

- MCP サーバー・OAuth 認可サーバーは、メインアプリ（`canshi`）とは別の Cloudflare Workers
  として新設する。別ホスト名（サブドメイン）で公開し、メインアプリの Worker・Access ポリシー
  （`All traffic`）には変更を加えない
- トランスポートは Streamable HTTP を使う
- 認可サーバーの実装には `@cloudflare/workers-oauth-provider` を使う
- upstream の ID プロバイダーとして Cloudflare Access を使い、新規の外部 IdP は導入しない。
  MCP 用 Worker の `/authorize` から Cloudflare Access のログインへリダイレクトする
- MCP 用 Worker からメインアプリのデータへは、Service Bindings 経由でメインアプリの Worker を
  呼び出す（D1 の直接バインドはしない。クエリロジックの重複を避けるため）
- クライアント登録は当面 DCR（`workers-oauth-provider` の標準対応）を使う
- 最初に公開する MCP ツールは読み取り専用（猫のプロフィール参照、タイムライン参照など）から
  始め、書き込み系ツールは別 PR で改めて検討する

## 未決定事項（着手前に確認）

- MCP 用 Worker のリポジトリ配置（同一リポジトリ内の別ディレクトリ・別 `wrangler.toml` とする
  か、別リポジトリに分けるか）。Biome・TypeScript 設定の共有しやすさから、まずは同一
  リポジトリ内の別ディレクトリを想定
- MCP 用 Worker に割り当てるサブドメイン・カスタムドメインの検討（Cloudflare のゾーン設定が
  必要な、コード外の運用作業）
- MCP で公開する具体的なツール一覧・入出力スキーマ・スコープ設計
- メインアプリ側に用意する Service Bindings 用の RPC エントリーポイント（`WorkerEntrypoint`）
  の設計。既存の `src/worker.ts`（OpenNext のハンドラと `NotificationWorkflow` の export を
  兼ねる、`docs/plans/29_web_push.md` 参照）にどう追加するか
- OAuth のクライアント情報・認可コード・トークンの永続化先（`workers-oauth-provider` の標準
  ストレージが前提とするバインディングの種類を確認し、必要なら新規の Cloudflare リソース
  （例: KV Namespace）を MCP 用 Worker に追加する）
- 書き込み系ツールを提供するかどうか、提供する場合に破壊的操作（削除など）への確認フローを
  どう設けるか
- MCP サーバー・OAuth エンドポイントに対するレート制限・不正利用防止の要否
- ChatGPT 以外の MCP クライアントへの対応要否（今回はスコープ外だが、方針だけ確認しておく）

## PR 分割案

- `33` MCP 用 Worker の新設・プロジェクト基盤（別ディレクトリ・別 `wrangler.toml`、メインアプリ
  との Service Bindings 接続、CI・デプロイパイプラインの追加）
- `34` MCP 用 OAuth 基盤（`@cloudflare/workers-oauth-provider` 導入、Cloudflare Access を
  upstream にした `/authorize` 実装、トークン発行・保存先の追加）
- `35` MCP サーバー本体・読み取り専用ツール（猫プロフィール・タイムライン参照。メインアプリ
  側に対応する Service Bindings 用 RPC エントリーポイントを追加）
- `36` ChatGPT カスタムコネクタでの接続確認・`docs/deploy.md` への設定手順追記
  （MCP 用サブドメインの DNS・Access 設定を含む）
- （将来）書き込み系ツールの追加 PR

## 参考資料

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [cloudflare/workers-oauth-provider](https://github.com/cloudflare/workers-oauth-provider)
- [Cloudflare Workers: Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Cloudflare Agents: Build a Remote MCP server](https://developers.cloudflare.com/agents/model-context-protocol/guides/remote-mcp-server/)
- [Cloudflare Agents: MCP Authorization](https://developers.cloudflare.com/agents/model-context-protocol/protocol/authorization/)
- [Cloudflare Blog: The next generation of MCP](https://blog.cloudflare.com/mcp-v2/)
- [Cloudflare One: Generic OIDC](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/generic-oidc/)
- [Cloudflare One: SaaS applications（OIDC/SAML での SSO 提供）](https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/saas-apps)
- [eidam/cf-access-workers-oidc（Cloudflare Access を OIDC provider 化する社外 OSS の実装例）](https://github.com/eidam/cf-access-workers-oidc)
- [OpenAI: Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
- [OpenAI: Building MCP servers for plugins and API integrations](https://developers.openai.com/api/docs/mcp)
