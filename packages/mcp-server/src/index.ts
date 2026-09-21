// PR33 時点では、Service Bindings 経由でメインアプリの `McpRpc`
// （canshi の src/worker.ts）を呼び出せることを確認するための最小限の実装。
// OAuth 2.1 認可サーバー・MCP プロトコル本体は別 PR（34, 35）で追加する。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      const cats = await env.MAIN_APP.listCats();
      return Response.json({ ok: true, catCount: cats.length });
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
