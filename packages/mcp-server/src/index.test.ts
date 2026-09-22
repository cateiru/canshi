import { describe, expect, it } from "vitest";
import worker from "./index";

describe("fetch", () => {
  it("returns 404 for unknown paths", async () => {
    const request = new Request("https://mcp.example.test/unknown");
    // @ts-expect-error テストではダミーの env を渡す
    const response = await worker.fetch(request, {}, {} as ExecutionContext);
    expect(response.status).toBe(404);
  });

  it("/healthz は認証なしで到達できるため、D1 を読み出す値を含まない", async () => {
    const request = new Request("https://mcp.example.test/healthz");
    // @ts-expect-error テストではダミーの env を渡す
    const response = await worker.fetch(request, {}, {} as ExecutionContext);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
