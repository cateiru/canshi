import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { type ZodRawShape, z } from "zod";
import { getUserById } from "@/features/auth/infrastructure/users";
import { registerOperations } from "@/features/external-access/presentation/operations";
import type {
  OperationAccess,
  OperationCaller,
  OperationContext,
} from "@/features/external-access/presentation/operations/context";
import type {
  OperationConfig,
  OperationError,
  OperationRegistry,
  OperationResult,
} from "@/features/external-access/presentation/operations/registry";
import {
  getClientIdFromProps,
  getUserIdFromProps,
  type McpProps,
  MISSING_CLIENT_ERROR_MESSAGE,
  MISSING_USER_ERROR_MESSAGE,
} from "../domain/props";
import { getMcpPermissions } from "../infrastructure/permissions";

/**
 * `OAuthProvider` の `apiHandler` に渡す、MCP サーバー（`route`、`/mcp`）の HTTP ハンドラを作る。
 *
 * MCP の 2026-07-28 版の仕様（セッションを持たない）に沿って、リクエストごとに
 * `createCanshiMcpServer()` で MCP サーバーを作り直して応答する。`initialize` で始める
 * それより前の版（2025-11-25 など）のクライアントにも、同じくリクエストごとに作り直した
 * サーバーで、セッションを持たずに応答する（`agents` の `createMcpHandler()`）。
 * ユーザーと接続は、リクエストごとの `ctx.props`（`../infrastructure/clientId.ts` の `withMcpClientId` が
 * 接続の ID を入れたもの）から求める
 */
export function createCanshiMcpHandler(route: string) {
  return {
    fetch(request, env, ctx) {
      const props = ctx.props as McpProps | undefined;
      const { origin } = new URL(request.url);
      return createMcpHandler(() => createCanshiMcpServer(env, props, origin), {
        route,
      }).fetch(request);
    },
  } satisfies { fetch: ExportedHandlerFetchHandler<Env> };
}

/** メッセージに使う、AI との接続の呼び方 */
const MCP_CALLER: OperationCaller = {
  name: "この接続",
  settings: "設定の「AIとの接続」",
  howToAllow:
    "CANSHI の設定の「AIとの接続」で、ユーザーに許可してもらってください",
};

function unauthorized(message: string): { error: OperationError } {
  return { error: { code: "unauthorized", message } };
}

/**
 * ツールを呼んだユーザーと、接続（OAuth のクライアント）に許可した範囲。範囲は
 * 接続ごとに設定する。ユーザー ID を持たないトークンや、削除されたユーザーのトークン、
 * 接続を求められなかったリクエスト（`../infrastructure/clientId.ts`）では、ツールの結果として返す
 * エラーを返す。接続が分からないまま範囲を決めると、制限した範囲を
 * 読み取れてしまうため、読み取りを断る
 */
async function resolveAccess(
  env: Env,
  props: McpProps | undefined,
): Promise<OperationAccess | { error: OperationError }> {
  const userId = getUserIdFromProps(props);
  if (!userId) {
    return unauthorized(MISSING_USER_ERROR_MESSAGE);
  }
  const clientId = getClientIdFromProps(props);
  if (!clientId) {
    return unauthorized(MISSING_CLIENT_ERROR_MESSAGE);
  }
  if (!(await getUserById(userId, env.DB))) {
    return unauthorized("ユーザーが見つかりません。MCP に接続し直してください");
  }
  return {
    userId,
    // 接続を許可したユーザーと接続の両方を、記録を操作した人として残す
    actor: { userId, mcpClientId: clientId, apiTokenId: null },
    permissions: await getMcpPermissions(userId, clientId, env.DB),
  };
}

/** 操作の結果を、MCP のツールの結果にする */
function toToolResult(result: OperationResult) {
  if ("error" in result) {
    return {
      content: [{ type: "text" as const, text: result.error.message }],
      isError: true,
    };
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result.data) }],
  };
}

/** 操作を MCP のツールとして登録する */
function toolRegistry(server: McpServer): OperationRegistry {
  return {
    register<TShape extends ZodRawShape>(
      name: string,
      { inputSchema, ...config }: OperationConfig<TShape>,
      handler: (
        args: z.output<z.ZodObject<TShape>>,
      ) => Promise<OperationResult>,
    ) {
      if (!inputSchema) {
        server.registerTool(name, config, async () =>
          toToolResult(await handler({} as z.output<z.ZodObject<TShape>>)),
        );
        return;
      }
      server.registerTool(
        name,
        { ...config, inputSchema: z.object(inputSchema) },
        async (args) => toToolResult(await handler(args)),
      );
    },
  };
}

/**
 * CANSHI の MCP サーバー本体（`/mcp`）。外部接続から行える操作
 * （`src/features/external-access/presentation/operations/`）を、ツールとして公開する
 * （docs/plans/32_mcp_oidc_overview.md 参照）。リクエストごとに作る（`createCanshiMcpHandler`）。
 *
 * 各ツールはトークンに保存した CANSHI のユーザー ID（`props.userId`、
 * `/oauth/authorize` で同意したときにログインしていたユーザー）の家の猫のうち、
 * そのユーザーがこの接続（`props.clientId`）に読み取りを許可した家・猫・記録の種類
 * （`../infrastructure/permissions.ts`）だけを参照する。
 * 許可していない猫は、存在しない猫と区別しない。記録の書き込みや家ごとの操作（ごはん商品・
 * プリセット・家・猫など）は、接続に許可した操作だけを、読み取りを許可した範囲の中で行える。共通のごはん商品は、
 * admin のユーザーが接続に許可した操作だけを行える。
 * Next.js（OpenNext）の外で動くため、D1 は `getCloudflareContext()` ではなく
 * `env.DB` を明示的に渡す
 */
export function createCanshiMcpServer(
  env: Env,
  props: McpProps | undefined,
  origin: string,
): McpServer {
  const server = new McpServer({
    name: "CANSHI MCP Server",
    version: "0.1.0",
  });
  const ctx: OperationContext = {
    env,
    origin,
    caller: MCP_CALLER,
    resolveAccess: () => resolveAccess(env, props),
  };
  registerOperations(toolRegistry(server), ctx);
  return server;
}
