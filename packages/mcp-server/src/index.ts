// PR33 時点では、Service Bindings 経由でメインアプリの `McpRpc`
// （canshi の src/worker.ts）を呼び出せることを確認するための最小限の実装。
// OAuth 2.1 認可サーバー・MCP プロトコル本体は別 PR（34, 35）で追加する。
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // 認証なしで到達できるため、D1 を読み出す値（猫の件数等）は返さない。
    // Service Bindings の疎通確認は `wrangler dev` での手動確認で行う
    // （README.md 参照）
    if (url.pathname === "/healthz") {
      return Response.json({ ok: true });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
