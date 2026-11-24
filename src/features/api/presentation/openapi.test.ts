// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { API_ROUTES, apiPathParams } from "../domain/routes";
import { handleApiRequest } from "./app";
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

type OpenApiOperation = {
  operationId: string;
  description: string;
  security: unknown;
  parameters?: {
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema: object;
  }[];
  requestBody?: {
    required: boolean;
    content: {
      "application/json": {
        schema: { properties: object; additionalProperties: boolean };
      };
    };
  };
};

type OpenApiDocument = {
  openapi: string;
  servers: unknown;
  paths: Record<string, Record<string, OpenApiOperation>>;
};

/** トークンなしで読む。DB は使わず、履歴にも残さない */
async function fetchDocument() {
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
  return (await response.json()) as OpenApiDocument;
}

describe("API の仕様（OpenAPI）", () => {
  it("すべてのエンドポイントを載せる", async () => {
    const document = await fetchDocument();
    expect(document.openapi).toBe("3.1.0");
    expect(document.servers).toEqual([{ url: "https://canshi.test/api/v1" }]);
    const endpoints = Object.entries(document.paths).flatMap(
      ([path, methods]) =>
        Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(endpoints.sort()).toEqual(
      API_ROUTES.map(({ method, path }) => `${method} ${path}`).sort(),
    );
  });

  it("パス・クエリ・本文の引数を分けて載せる", async () => {
    const { paths } = await fetchDocument();
    const timeline = paths["/cats/{catId}/timeline"].get;
    expect(timeline.security).toEqual([{ apiToken: [] }]);
    expect(timeline.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "catId", in: "path", required: true }),
        expect.objectContaining({
          name: "month",
          in: "query",
          required: true,
          description: "月（1〜12）",
          schema: expect.objectContaining({
            type: "integer",
            minimum: 1,
            maximum: 12,
          }),
        }),
        expect.objectContaining({
          name: "page",
          in: "query",
          required: false,
          description: "ページ番号（1始まり、省略時は1）",
          schema: expect.objectContaining({ type: "integer", minimum: 1 }),
        }),
      ]),
    );

    const create = paths["/cats/{catId}/poop-records"].post;
    expect(create.parameters?.map(({ name }) => name)).toEqual(["catId"]);
    const { schema } = (
      create.requestBody as Required<OpenApiOperation>["requestBody"]
    ).content["application/json"];
    expect(schema.properties).toHaveProperty("consistency");
    expect(schema.properties).not.toHaveProperty("catId");
    expect(schema.additionalProperties).toBe(false);
  });

  it("MCP のツールの名前や呼び方を含まない", async () => {
    const { paths, ...rest } = await fetchDocument();
    const text = JSON.stringify([
      rest,
      Object.values(paths).map((methods) =>
        Object.values(methods).map((operation) => ({
          ...operation,
          operationId: undefined,
        })),
      ),
    ]);
    for (const name of operations.keys()) {
      expect(text).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
    expect(text).not.toContain("この接続");
    expect(text).not.toContain("AIとの接続");
  });
});
