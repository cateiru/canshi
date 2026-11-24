// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { API_ROUTES, apiPathParams } from "../domain/routes";
import { handleApiRequest } from "./handler";
import { buildOpenApiDocument } from "./openapi";
import { API_CALLER, collectApiOperations } from "./operationRegistry";

vi.mock("@/db/client", () => ({
  getDb: () => {
    throw new Error("API の仕様を作るときは DB を使わない");
  },
}));

const operations = collectApiOperations({
  env: {} as Env,
  origin: "https://canshi.test",
  caller: API_CALLER,
  resolveAccess: async () => {
    throw new Error("呼ばれない");
  },
});

describe("エンドポイント", () => {
  it("すべての操作に、ちょうど 1 つのエンドポイントがある", () => {
    expect(API_ROUTES.map((route) => route.operation).sort()).toEqual(
      [...operations.keys()].sort(),
    );
  });

  it("メソッドとパスは重ならない", () => {
    const endpoints = API_ROUTES.map(
      ({ method, path }) => `${method} ${path.replace(/\{\w+\}/g, "{}")}`,
    );
    expect(new Set(endpoints).size).toBe(endpoints.length);
  });

  it("パスの引数は、操作の引数にある", () => {
    for (const route of API_ROUTES) {
      const shape = operations.get(route.operation)?.config.inputSchema ?? {};
      for (const name of apiPathParams(route.path)) {
        expect(shape, `${route.operation} の ${name}`).toHaveProperty(name);
      }
    }
  });
});

describe("buildOpenApiDocument", () => {
  const document = buildOpenApiDocument("https://canshi.test");

  it("パス・クエリ・本文の引数を分けて載せる", () => {
    expect(document.servers).toEqual([{ url: "https://canshi.test/api/v1" }]);
    expect(document.paths["/cats/{catId}/timeline"].get).toMatchObject({
      parameters: expect.arrayContaining([
        expect.objectContaining({ name: "catId", in: "path", required: true }),
        expect.objectContaining({ name: "year", in: "query", required: true }),
        expect.objectContaining({ name: "page", in: "query", required: false }),
      ]),
    });
    const create = document.paths["/cats/{catId}/poop-records"].post as {
      requestBody: {
        content: {
          "application/json": { schema: { properties: object } };
        };
      };
    };
    const { properties } =
      create.requestBody.content["application/json"].schema;
    expect(properties).toHaveProperty("consistency");
    expect(properties).not.toHaveProperty("catId");
  });

  it("MCP のツールの名前や呼び方を含まない", () => {
    const text = JSON.stringify({
      ...document,
      paths: Object.values(document.paths).map((methods) =>
        Object.values(methods).map((operation) => ({
          ...(operation as object),
          operationId: undefined,
        })),
      ),
    });
    for (const name of operations.keys()) {
      expect(text).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
    expect(text).not.toContain("この接続");
    expect(text).not.toContain("AIとの接続");
  });

  it("トークンなしで読める", async () => {
    const response = await handleApiRequest(
      new Request("https://canshi.test/api/v1/openapi.json"),
      {
        env: {} as Env,
        defer: () => {
          throw new Error("履歴に残さない");
        },
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(JSON.parse(JSON.stringify(document)));
  });
});
