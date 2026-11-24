import { type ZodRawShape, z } from "zod";
import type { OperationContext } from "@/features/external-access/presentation/operations/context";
import { MAX_IMAGE_BASE64_LENGTH } from "@/features/external-access/presentation/operations/imageArgs";
import type { OperationErrorCode } from "@/features/external-access/presentation/operations/registry";
import { recordApiAccess } from "../application/mutations";
import { isApiTokenExpired, readBearerToken } from "../domain/apiToken";
import {
  API_BASE_PATH,
  API_OPENAPI_PATH,
  apiPathParams,
  matchApiRoute,
} from "../domain/routes";
import {
  type ApiTokenAccess,
  findApiTokenAccess,
} from "../infrastructure/queries";
import { buildOpenApiDocument } from "./openapi";
import {
  API_CALLER,
  collectApiOperations,
  toEndpointText,
} from "./operationRegistry";

/** 応答のエラーの種類。操作のエラーに、HTTP のリクエストのエラーを加えたもの */
type ApiErrorCode =
  | OperationErrorCode
  | "method_not_allowed"
  | "payload_too_large"
  | "internal_error";

const ERROR_STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  conflict: 409,
  payload_too_large: 413,
  internal_error: 500,
};

/** リクエストの本文の上限（バイト）。画像（base64）を 1 枚の上限まで送れる大きさにする */
const MAX_BODY_BYTES = MAX_IMAGE_BASE64_LENGTH + 1024 * 1024;

export interface ApiHandlerEnv {
  env: OperationContext["env"];
  /** 応答を返した後に行う処理（アクセス履歴の記録）を登録する */
  defer(task: () => Promise<void>): void;
}

/**
 * API（`/api/v1`）のリクエストを処理する。`Authorization: Bearer` のトークンで認証し、エンドポイントに
 * 対応する操作（`src/features/external-access/presentation/operations/`）を、トークンを発行したユーザーと
 * トークンに許可した範囲で行う。認証できたリクエストは、応答の内容によらずアクセス履歴に残す
 */
export async function handleApiRequest(
  request: Request,
  { env, defer }: ApiHandlerEnv,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.slice(API_BASE_PATH.length);

  // API の仕様は、トークンを発行する前にも読めるようにする
  if (path === API_OPENAPI_PATH && request.method === "GET") {
    return Response.json(buildOpenApiDocument(url.origin));
  }

  const accessedAt = new Date();
  const authenticated = await authenticate(request, env.DB, accessedAt);
  if ("error" in authenticated) {
    return errorResponse("unauthorized", authenticated.error, {
      "WWW-Authenticate": "Bearer",
    });
  }
  const { token } = authenticated;

  let response: Response;
  try {
    response = await dispatch(request, url, path, env, token);
  } catch (error) {
    console.error("API のリクエストの処理に失敗しました", error);
    response = errorResponse(
      "internal_error",
      "サーバーでエラーが発生しました。時間をおいて、もう一度お試しください",
    );
  }

  defer(async () => {
    try {
      await recordApiAccess(
        token.id,
        {
          method: request.method,
          path: url.pathname,
          status: response.status,
          // Cloudflare が付ける、送信元の IP アドレス（クライアントが送った値は上書きされる）
          ipAddress: request.headers.get("CF-Connecting-IP"),
          userAgent: request.headers.get("User-Agent"),
        },
        accessedAt,
        env.DB,
      );
    } catch (error) {
      console.error("API のアクセス履歴の記録に失敗しました", error);
    }
  });
  return response;
}

/** リクエストのトークンを確かめる。使えなければ、利用者に返すメッセージ */
async function authenticate(
  request: Request,
  d1: D1Database,
  now: Date,
): Promise<{ token: ApiTokenAccess } | { error: string }> {
  const value = readBearerToken(request.headers.get("Authorization"));
  if (!value) {
    return {
      error:
        "API トークンを Authorization ヘッダーに「Bearer <トークン>」の形で指定してください",
    };
  }
  const token = await findApiTokenAccess(value, d1);
  if (!token) {
    return { error: "API トークンが正しくないか、削除されています" };
  }
  if (isApiTokenExpired(token, now)) {
    return {
      error:
        "API トークンの有効期限が切れています。新しいトークンを発行してください",
    };
  }
  return { token };
}

async function dispatch(
  request: Request,
  url: URL,
  path: string,
  env: OperationContext["env"],
  token: ApiTokenAccess,
): Promise<Response> {
  const match = matchApiRoute(request.method, path);
  if (!match) {
    return errorResponse("not_found", "エンドポイントが見つかりません");
  }
  if (!match.route) {
    return errorResponse(
      "method_not_allowed",
      `このエンドポイントは ${match.allow.join("・")} だけを受け付けます`,
      { Allow: match.allow.join(", ") },
    );
  }
  const { route, params } = match;

  const operation = collectApiOperations({
    env,
    origin: url.origin,
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

  const shape = operation.config.inputSchema ?? {};
  // GET・DELETE は本文を持たないため、パス以外の引数はクエリで受け取る
  const input =
    route.method === "GET" || route.method === "DELETE"
      ? { values: readQuery(url.searchParams, shape) }
      : await readJsonBody(request);
  if ("error" in input) {
    return errorResponse(input.error, input.message);
  }
  // パスの引数をクエリ・本文でも指定されたときは、知らない引数として断る
  const pathParams = apiPathParams(route.path);
  const parsed = z
    .strictObject(
      Object.fromEntries(
        Object.entries(shape).filter(([key]) => !pathParams.includes(key)),
      ),
    )
    .safeParse(input.values);
  if (!parsed.success) {
    return errorResponse("invalid_request", formatIssues(parsed.error));
  }

  const result = await operation.call({ ...parsed.data, ...params });
  if ("error" in result) {
    return errorResponse(
      result.error.code,
      toEndpointText(result.error.message),
    );
  }
  return Response.json(result.data, {
    status: route.successStatus,
    headers: RESPONSE_HEADERS,
  });
}

const RESPONSE_HEADERS = { "Cache-Control": "private, no-store" };

function errorResponse(
  code: ApiErrorCode,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json(
    { error: { code, message } },
    {
      status: ERROR_STATUS[code],
      headers: { ...RESPONSE_HEADERS, ...headers },
    },
  );
}

/** クエリを引数にする。値は文字列のため、文字列を受け付けない引数（年・ページなど）は数値に直す */
function readQuery(
  searchParams: URLSearchParams,
  shape: ZodRawShape,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of searchParams) {
    const schema = Object.hasOwn(shape, key) ? shape[key] : undefined;
    const isNumber =
      schema !== undefined &&
      /^-?\d+(\.\d+)?$/.test(value) &&
      !z.safeParse(schema, value).success;
    values[key] = isNumber ? Number(value) : value;
  }
  return values;
}

/** JSON の本文を読む。本文が空なら、引数を指定しないものとして扱う */
async function readJsonBody(
  request: Request,
): Promise<
  { values: Record<string, unknown> } | { error: ApiErrorCode; message: string }
> {
  const text = await readBody(request);
  if (text === null) {
    return {
      error: "payload_too_large",
      message: `本文は ${MAX_BODY_BYTES} バイトまでにしてください`,
    };
  }
  if (text.trim() === "") {
    return { values: {} };
  }
  try {
    const json: unknown = JSON.parse(text);
    if (typeof json === "object" && json !== null && !Array.isArray(json)) {
      return { values: json as Record<string, unknown> };
    }
  } catch {
    // 下でエラーを返す
  }
  return {
    error: "invalid_request",
    message: "本文は JSON のオブジェクトで指定してください",
  };
}

/** 本文を文字列で読む。`MAX_BODY_BYTES` を超えたら、最後まで読まずに null を返す */
async function readBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get("Content-Length") ?? 0) > MAX_BODY_BYTES) {
    return null;
  }
  if (!request.body) {
    return "";
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return text + decoder.decode();
    }
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

function formatIssues(error: z.ZodError) {
  const messages = error.issues.map((issue) =>
    issue.path.length > 0
      ? `${issue.path.join(".")}: ${issue.message}`
      : issue.message,
  );
  return `入力が正しくありません。${[...new Set(messages)].join(" / ")}`;
}
