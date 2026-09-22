# @canshi/mcp-server

CANSHI のデータ（猫のプロフィール・タイムライン）を外部の AI エージェント（ChatGPT のカスタムコネクタ等）
から参照できるようにする MCP（Model Context Protocol）サーバー。メインアプリ（`canshi`）とは別の
Cloudflare Workers として動作する。設計の背景は [`docs/plans/32_mcp_oidc_overview.md`](../../docs/plans/32_mcp_oidc_overview.md)
を参照。

## 開発コマンド

リポジトリルートから `pnpm --filter @canshi/mcp-server <script>` で実行するか、このディレクトリで直接
実行する。

```bash
pnpm dev         # wrangler dev でローカル起動
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
pnpm cf-typegen  # wrangler.jsonc から worker-configuration.d.ts を再生成
pnpm deploy      # wrangler deploy
```

## メインアプリとの連携（Service Bindings）

`wrangler.jsonc` の `services` バインディング（`MAIN_APP`）経由で、メインアプリ（`canshi`）の
`src/worker.ts` が export する `McpRpc`（`WorkerEntrypoint`）を直接呼び出す。公開 URL・DNS を経由
しないため、メインアプリの Cloudflare Access ポリシーの対象にならない。

ローカルでの動作確認には、メインアプリ側の `wrangler dev` も同時に起動しておく必要がある
（`wrangler dev` は Service Bindings 先の Worker もローカルで解決する）。

```bash
# リポジトリルートの別ターミナルで
pnpm cf:build && wrangler dev

# このディレクトリで
pnpm dev
```

起動後、`http://localhost:<port>/healthz` にアクセスすると `{ ok: true }` が返る
（認証なしで到達できるため、D1 を読み出す値は含まない）。Service Bindings の疎通は
`wrangler dev` の起動ログで `env.MAIN_APP (canshi#McpRpc) Worker local [connected]`
と表示されることで確認できる。

## MCP ツール

`/mcp`（Streamable HTTP、OAuth 2.1 の Bearer トークンで保護）で以下の読み取り専用ツールを
公開している（`src/mcp/agent.ts`）。書き込み系ツールは対象外
（`docs/plans/32_mcp_oidc_overview.md` 参照）。

| ツール | 内容 |
| --- | --- |
| `list_cats` | 登録されている猫のプロフィール一覧 |
| `get_cat_profile` | 指定した ID の猫のプロフィール1件 |
| `list_timeline` | 指定した猫・年月の記録（ごはん・うんち・体重・通院・投薬など）一覧 |

いずれもメインアプリの `McpRpc`（`src/worker.ts`）を Service Bindings 経由で呼び出す薄いラッパー。
RPC の戻り値の型は `src/rpc/mainApp.ts` に手動で複製した契約（`MainAppRpc`）を参照しており、
`McpRpc` 側でメソッドを追加・変更したら、あわせて更新すること。

## OAuth 認可フロー（`src/auth/`）

`/authorize`（クライアント承認ダイアログ）→ Cloudflare Access（upstream IdP）への
リダイレクト → `/callback` という OAuth 2.1 認可コードフロー（PKCE 付き）を実装している。
詳細は `src/auth/handler.ts`・`src/auth/oauth-state.ts`・`src/auth/access.ts`・
`src/auth/approval.ts` のコメントを参照。

DCR（`/register`）は誰でも呼べるため、`/authorize` では要求元クライアントを表示する
承認ダイアログ（CSRF トークン付き）を経由してから Access へリダイレクトする。一度承認した
クライアントは署名付き Cookie で記憶する。

Access との実連携にはダッシュボードでの SaaS OIDC アプリ登録が必要なため、このリポジトリの
自動テストでは検証できない（`oauth-state.test.ts`・`access.test.ts`・`approval.test.ts` で
個々のロジックを検証）。`wrangler dev` での手動確認手順は
[`docs/deploy.md`](../../docs/deploy.md) の「MCP サーバー（外部 AI エージェント連携）」節を参照。
