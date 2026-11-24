import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { methodNotAllowed } from "hono/method-not-allowed";
import type { ZodRawShape } from "zod";
import type { OperationContext } from "@/features/external-access/presentation/operations/context";
import { MAX_IMAGE_BASE64_LENGTH } from "@/features/external-access/presentation/operations/imageArgs";
import type { OperationErrorCode } from "@/features/external-access/presentation/operations/registry";
import { recordApiAccess } from "../application/mutations";
import {
  API_TOKEN_PREFIX,
  isApiTokenExpired,
  readBearerToken,
} from "../domain/apiToken";
import {
  API_BASE_PATH,
  API_OPENAPI_PATH,
  API_ROUTE_GROUPS,
  type ApiRoute,
  apiPathParams,
} from "../domain/routes";
import {
  type ApiTokenAccess,
  findApiTokenAccess,
} from "../infrastructure/queries";
import {
  API_CALLER,
  type ApiOperation,
  collectApiOperations,
  toEndpointText,
} from "./operationRegistry";

/** 応答のエラーの種類。操作のエラーに、HTTP のリクエストのエラーを加えたもの */
const ERROR_STATUS = {
  invalid_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  conflict: 409,
  payload_too_large: 413,
  unsupported_media_type: 415,
  internal_error: 500,
} as const;

type ApiErrorCode = keyof typeof ERROR_STATUS;

// 操作のエラーの種類には、すべて HTTP のステータスを決める
ERROR_STATUS satisfies Record<OperationErrorCode, number>;

/** リクエストの本文の上限（バイト）。画像（base64）を 1 枚の上限まで送れる大きさにする */
const MAX_BODY_BYTES = MAX_IMAGE_BASE64_LENGTH + 1024 * 1024;

export interface ApiBindings {
  env: OperationContext["env"];
  /** 応答を返した後に行う処理（アクセス履歴の記録）を登録する */
  defer(task: () => Promise<void>): void;
}

type ApiAppEnv = {
  Bindings: ApiBindings;
  Variables: { token: ApiTokenAccess };
};

let app: ReturnType<typeof createApiApp> | undefined;

/**
 * API（`/api/v1`）のリクエストを処理する。`Authorization: Bearer` のトークンで認証し、エンドポイントに
 * 対応する操作（`src/features/external-access/presentation/operations/`）を、トークンを発行したユーザーと
 * トークンに許可した範囲で行う。認証できたリクエストは、応答の内容によらずアクセス履歴に残す
 */
export async function handleApiRequest(
  request: Request,
  bindings: ApiBindings,
): Promise<Response> {
  app ??= createApiApp();
  return app.fetch(request, bindings);
}

function createApiApp() {
  const app = new OpenAPIHono<ApiAppEnv>({
    // エンドポイントの一覧・仕様のパスに合わせ、`API_BASE_PATH` より後ろで振り分ける
    getPath: (request) =>
      new URL(request.url).pathname.slice(API_BASE_PATH.length),
    defaultHook: (result, c) => {
      if (!result.success) {
        return errorResponse(
          c,
          "invalid_request",
          formatIssues(result.error.issues),
        );
      }
    },
  });

  app.notFound((c) =>
    errorResponse(c, "not_found", "エンドポイントが見つかりません"),
  );
  app.onError((error, c) => {
    // 引数の検証の前に Hono が断ったもの（本文の形式の誤り）
    if (error instanceof HTTPException && error.status === 400) {
      return errorResponse(
        c,
        "invalid_request",
        "本文は JSON で指定してください",
      );
    }
    if (error instanceof HTTPException && error.status === 415) {
      return errorResponse(
        c,
        "unsupported_media_type",
        "本文は JSON で送り、Content-Type を application/json にしてください",
      );
    }
    console.error("API のリクエストの処理に失敗しました", error);
    return errorResponse(
      c,
      "internal_error",
      "サーバーでエラーが発生しました。時間をおいて、もう一度お試しください",
    );
  });

  // API の仕様は、トークンを発行する前にも読めるよう、認証より先に登録する
  app.get(API_OPENAPI_PATH, (c) =>
    c.json(toEndpointDescriptions(openApiDocument(new URL(c.req.url).origin))),
  );

  app.use(async (c, next) => {
    await next();
    c.res.headers.set("Cache-Control", "private, no-store");
  });
  app.use(authenticate);
  app.use(
    methodNotAllowed({
      app,
      onMethodNotAllowed: (c, methods) =>
        errorResponse(
          c,
          "method_not_allowed",
          `このエンドポイントは ${methods.join("・")} だけを受け付けます`,
          { Allow: methods.join(", ") },
        ),
    }),
  );
  app.use(
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) =>
        errorResponse(
          c,
          "payload_too_large",
          `本文は ${MAX_BODY_BYTES} バイトまでにしてください`,
        ),
    }),
  );

  // 登録するときは、操作の引数の定義だけを使う。操作は、リクエストごとにトークンの範囲で作り直して呼ぶ
  const definitions = collectApiOperations({
    env: {} as OperationContext["env"],
    origin: "",
    caller: API_CALLER,
    resolveAccess: async () => {
      throw new Error("API の定義からは操作を呼びません");
    },
  });
  for (const group of API_ROUTE_GROUPS) {
    for (const route of group.routes) {
      const definition = definitions.get(route.operation);
      if (!definition) {
        throw new Error(`操作 ${route.operation} が登録されていません`);
      }
      app.openapi(
        toRouteConfig(route, definition, group.label),
        // 引数・応答の型は操作ごとに違い、一覧からは決まらないため、型では確かめない
        (async (c: Context<ApiAppEnv>) => callOperation(c, route)) as never,
      );
    }
  }

  app.openAPIRegistry.registerComponent("securitySchemes", "apiToken", {
    type: "http",
    scheme: "bearer",
    bearerFormat: `${API_TOKEN_PREFIX}...`,
  });

  function openApiDocument(origin: string) {
    return app.getOpenAPI31Document({
      openapi: "3.1.0",
      info: {
        title: "CANSHI API",
        version: "1",
        description:
          "ねこの記録サービス CANSHI の API。設定の「外部接続」の「APIトークン」で発行したトークンを、" +
          "Authorization ヘッダーに「Bearer <トークン>」の形で指定する。" +
          "読み取れる範囲と行える操作は、トークンごとに選んだものに限る。",
      },
      servers: [{ url: `${origin}${API_BASE_PATH}` }],
    });
  }
  return app;
}

/** トークンを確かめ、使えるトークンのリクエストを、応答の後にアクセス履歴に残す */
async function authenticate(
  c: Context<ApiAppEnv>,
  next: () => Promise<void>,
): Promise<Response | undefined> {
  const accessedAt = new Date();
  const { env, defer } = c.env;
  const unauthorized = (message: string) =>
    errorResponse(c, "unauthorized", message, { "WWW-Authenticate": "Bearer" });

  const value = readBearerToken(c.req.header("Authorization") ?? null);
  if (!value) {
    return unauthorized(
      "API トークンを Authorization ヘッダーに「Bearer <トークン>」の形で指定してください",
    );
  }
  const token = await findApiTokenAccess(value, env.DB);
  if (!token) {
    return unauthorized("API トークンが正しくないか、削除されています");
  }
  if (isApiTokenExpired(token, accessedAt)) {
    return unauthorized(
      "API トークンの有効期限が切れています。新しいトークンを発行してください",
    );
  }
  c.set("token", token);

  await next();

  const { status } = c.res;
  defer(async () => {
    try {
      await recordApiAccess(
        token.id,
        {
          method: c.req.method,
          path: new URL(c.req.url).pathname,
          status,
          // Cloudflare が付ける、送信元の IP アドレス（クライアントが送った値は上書きされる）
          ipAddress: c.req.header("CF-Connecting-IP") ?? null,
          userAgent: c.req.header("User-Agent") ?? null,
        },
        accessedAt,
        env.DB,
      );
    } catch (error) {
      console.error("API のアクセス履歴の記録に失敗しました", error);
    }
  });
}

/** 検証した引数で、エンドポイントに対応する操作を呼ぶ */
async function callOperation(
  c: Context<ApiAppEnv>,
  route: ApiRoute,
): Promise<Response> {
  const token = c.get("token");
  const operation = collectApiOperations({
    env: c.env.env,
    origin: new URL(c.req.url).origin,
    caller: API_CALLER,
    // 範囲は、リクエストごとにトークンと一緒に読んだものを使う
    resolveAccess: async () => ({
      userId: token.userId,
      actor: { userId: token.userId, mcpClientId: null, apiTokenId: token.id },
      permissions: token.permissions,
    }),
  }).get(route.operation);
  if (!operation) {
    throw new Error(`操作 ${route.operation} が登録されていません`);
  }
  // 検証した引数の型は操作ごとに違うため、まとめて 1 つのオブジェクトとして扱う
  const request = c.req as unknown as {
    valid(target: "param" | "query" | "json"): Record<string, unknown>;
  };
  const result = await operation.call({
    ...request.valid("query"),
    ...request.valid("json"),
    ...request.valid("param"),
  });
  if ("error" in result) {
    return errorResponse(
      c,
      result.error.code,
      toEndpointText(result.error.message),
    );
  }
  return c.json(result.data as object, route.successStatus);
}

const errorSchema = z
  .object({
    error: z.object({
      code: z.enum(Object.keys(ERROR_STATUS) as [ApiErrorCode]),
      message: z.string(),
    }),
  })
  .openapi("Error");

/**
 * エンドポイントの定義。引数は操作の zod スキーマで検証し、仕様にも同じものを載せる。
 * 応答の本文の形は、操作が持っていないため載せない
 */
function toRouteConfig(route: ApiRoute, operation: ApiOperation, tag: string) {
  const shape = operation.config.inputSchema ?? {};
  const pathParams = apiPathParams(route.path);
  const entries = Object.entries(shape);
  const params = Object.fromEntries(
    entries.filter(([name]) => pathParams.includes(name)),
  );
  const others = Object.fromEntries(
    entries.filter(([name]) => !pathParams.includes(name)),
  );
  // GET・DELETE は本文を持たないため、パス以外の引数はクエリで受け取る。知らない引数や、
  // パスの引数のクエリ・本文での指定は断る
  const input =
    route.method === "GET" || route.method === "DELETE"
      ? { query: z.strictObject(toQueryShape(others)) }
      : Object.keys(others).length > 0
        ? {
            body: {
              required: true,
              content: {
                "application/json": { schema: z.strictObject(others) },
              },
            },
          }
        : {};
  return createRoute({
    method: route.method.toLowerCase() as Lowercase<ApiRoute["method"]>,
    path: route.path,
    operationId: route.operation,
    tags: [tag],
    summary: route.summary,
    description: operation.config.description,
    security: [{ apiToken: [] }],
    request: { params: z.object(params), ...input },
    responses: {
      [route.successStatus]: {
        description: "成功",
        content: { "application/json": { schema: z.unknown() } },
      },
      default: {
        description: "エラー",
        content: { "application/json": { schema: errorSchema } },
      },
    },
  });
}

/** クエリの値は文字列のため、数値の引数（年・ページなど）は数値に直してから検証する */
function toQueryShape(shape: ZodRawShape): ZodRawShape {
  return Object.fromEntries(
    Object.entries(shape).map(([name, schema]) => {
      const isOptional = schema instanceof z.ZodOptional;
      const inner = isOptional ? schema.unwrap() : schema;
      if (!(inner instanceof z.ZodNumber)) {
        return [name, schema];
      }
      const number = z.preprocess(
        (value) =>
          typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : value,
        inner,
      );
      const query = isOptional ? number.optional() : number;
      const { description } = schema as z.ZodType;
      return [name, description ? query.describe(description) : query];
    }),
  );
}

function errorResponse(
  c: Context,
  code: ApiErrorCode,
  message: string,
  headers: Record<string, string> = {},
) {
  return c.json({ error: { code, message } }, ERROR_STATUS[code], headers);
}

function formatIssues(
  issues: readonly { path: PropertyKey[]; message: string }[],
) {
  const messages = issues.map((issue) =>
    issue.path.length > 0
      ? `${issue.path.join(".")}: ${issue.message}`
      : issue.message,
  );
  return `入力が正しくありません。${[...new Set(messages)].join(" / ")}`;
}

/** 仕様の説明（`description`）に含まれる操作の名前を、エンドポイントに置き換える */
function toEndpointDescriptions<T>(document: T): T {
  return JSON.parse(JSON.stringify(document), (key, value) =>
    key === "description" && typeof value === "string"
      ? toEndpointText(value)
      : value,
  );
}
