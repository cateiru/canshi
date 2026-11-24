import { z } from "zod";
import { API_TOKEN_PREFIX } from "../domain/apiToken";
import {
  API_BASE_PATH,
  API_ROUTE_GROUPS,
  type ApiRoute,
  apiPathParams,
} from "../domain/routes";
import {
  API_CALLER,
  type ApiOperation,
  collectApiOperations,
  toEndpointText,
} from "./operationRegistry";

type JsonSchema = Record<string, unknown>;

/**
 * API の仕様（OpenAPI 3.1）。エンドポイントの一覧（`../domain/routes.ts`）と、操作の引数の
 * zod スキーマから作る。応答の本文の形は持たない
 */
export function buildOpenApiDocument(origin: string) {
  const operations = collectApiOperations({
    // 操作は登録するだけで呼ばないため、環境は使われない
    env: {} as Env,
    origin,
    caller: API_CALLER,
    resolveAccess: async () => {
      throw new Error("API の仕様を作るときは操作を呼びません");
    },
  });

  const paths: Record<string, Record<string, unknown>> = {};
  for (const group of API_ROUTE_GROUPS) {
    for (const route of group.routes) {
      const operation = operations.get(route.operation);
      if (!operation) {
        throw new Error(`操作 ${route.operation} が登録されていません`);
      }
      paths[route.path] = {
        ...paths[route.path],
        [route.method.toLowerCase()]: toOpenApiOperation(
          route,
          operation,
          group.label,
        ),
      };
    }
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "CANSHI API",
      version: "1",
      description:
        "ねこの記録サービス CANSHI の API。設定の「外部接続」の「APIトークン」で発行したトークンを、" +
        "Authorization ヘッダーに「Bearer <トークン>」の形で指定する。" +
        "読み取れる範囲と行える操作は、トークンごとに選んだものに限る。" +
        "エラーの本文は { error: { code, message } }。",
    },
    servers: [{ url: `${origin}${API_BASE_PATH}` }],
    security: [{ apiToken: [] }],
    components: {
      securitySchemes: {
        apiToken: {
          type: "http",
          scheme: "bearer",
          bearerFormat: `${API_TOKEN_PREFIX}...`,
        },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
    paths,
  };
}

function toOpenApiOperation(
  route: ApiRoute,
  operation: ApiOperation,
  tag: string,
) {
  const schema = toJsonSchema(operation);
  const pathParams = apiPathParams(route.path);
  const others = Object.entries(schema.properties).filter(
    ([name]) => !pathParams.includes(name),
  );
  const hasBody = route.method !== "GET" && route.method !== "DELETE";
  const required = schema.required.filter((name) => !pathParams.includes(name));
  return {
    operationId: route.operation,
    tags: [tag],
    summary: route.summary,
    description: toEndpointText(operation.config.description),
    parameters: [
      ...pathParams.map((name) =>
        toParameter(name, "path", true, schema.properties[name]),
      ),
      ...(hasBody
        ? []
        : others.map(([name, property]) =>
            toParameter(name, "query", required.includes(name), property),
          )),
    ],
    ...(hasBody && others.length > 0
      ? {
          requestBody: {
            required: required.length > 0,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: Object.fromEntries(others),
                  required,
                  additionalProperties: false,
                },
              },
            },
          },
        }
      : {}),
    responses: {
      [route.successStatus]: {
        description: "成功",
        content: { "application/json": {} },
      },
      default: {
        description: "エラー",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
  };
}

function toParameter(
  name: string,
  location: "path" | "query",
  required: boolean,
  property: JsonSchema,
) {
  const { description, ...schema } = property;
  return { name, in: location, required, description, schema };
}

/** 操作の引数の JSON Schema。説明に含まれる操作の名前は、エンドポイントに置き換える */
function toJsonSchema(operation: ApiOperation): {
  properties: Record<string, JsonSchema>;
  required: string[];
} {
  const { properties = {}, required = [] } = z.toJSONSchema(
    z.object(operation.config.inputSchema ?? {}),
    {
      io: "input",
      override: ({ jsonSchema }) => {
        if (jsonSchema.description) {
          jsonSchema.description = toEndpointText(jsonSchema.description);
        }
      },
    },
  );
  return { properties: properties as Record<string, JsonSchema>, required };
}
