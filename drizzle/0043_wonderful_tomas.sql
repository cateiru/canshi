-- MCP の OAuth 認可サーバー（@cloudflare/workers-oauth-provider）のクライアント登録・認可・トークンを、
-- Workers KV ではなく D1 に保存するためのテーブル（src/features/mcp/d1KvStore.ts）。
-- テーブルを追加するだけなので、古いコードのまま先に適用しても影響はない。
-- 新しいコードはこのテーブルが無いと MCP の接続（/oauth/register など）が失敗するため、
-- マージ（デプロイ）より前に必ず pnpm db:migrate:remote で適用すること。
CREATE TABLE `oauth_kv_entries` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `oauth_kv_entries_expires_at_idx` ON `oauth_kv_entries` (`expires_at`);