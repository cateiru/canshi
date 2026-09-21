import { describe, expect, it } from "vitest";
import worker from "./index";

describe("fetch", () => {
  it("returns 404 for unknown paths", async () => {
    const request = new Request("https://mcp.example.test/unknown");
    // @ts-expect-error テストではダミーの env を渡す
    const response = await worker.fetch(request, {}, {} as ExecutionContext);
    expect(response.status).toBe(404);
  });

  it("calls MAIN_APP.listCats() via the Service Binding for /healthz", async () => {
    const request = new Request("https://mcp.example.test/healthz");
    const env = {
      MAIN_APP: {
        listCats: async () => [{ id: "cat-1", name: "たま" }],
      },
    };
    // @ts-expect-error テストではダミーの env を渡す
    const response = await worker.fetch(request, env, {} as ExecutionContext);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, catCount: 1 });
  });
});
