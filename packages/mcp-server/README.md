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
