import type { ZodRawShape, z } from "zod";

/**
 * 外部接続（AI との接続・API）から行える操作の型。操作の実装は通信の方式（MCP・HTTP）に依存せず、
 * MCP のツール（`src/features/mcp/presentation/agent.ts`）などから呼ぶ
 */

/** 操作に失敗した理由の種類。API では HTTP のステータスに対応させる */
export type OperationErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict";

export interface OperationError {
  code: OperationErrorCode;
  /** AI・API の利用者に返すメッセージ */
  message: string;
}

/** 操作の結果。`data` は JSON にして返す値 */
export type OperationResult = { data: unknown } | { error: OperationError };

export interface OperationConfig<TShape extends ZodRawShape> {
  title: string;
  description: string;
  /** 引数。省略すると引数を取らない */
  inputSchema?: TShape;
  /** MCP のツールの annotations。API では使わない */
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  };
}

/** 操作の登録先 */
export interface OperationRegistry {
  register<TShape extends ZodRawShape = Record<never, never>>(
    name: string,
    config: OperationConfig<TShape>,
    handler: (args: z.output<z.ZodObject<TShape>>) => Promise<OperationResult>,
  ): void;
}

export function notFoundError(message: string): OperationError {
  return { code: "not_found", message };
}

export function forbiddenError(message: string): OperationError {
  return { code: "forbidden", message };
}

export function conflictError(message: string): OperationError {
  return { code: "conflict", message };
}

/** 失敗の結果。文字列だけを渡したときは、引数が正しくないものとして扱う */
export function errorResult(error: string | OperationError): OperationResult {
  return {
    error:
      typeof error === "string"
        ? { code: "invalid_request", message: error }
        : error,
  };
}

export function jsonResult(data: unknown): OperationResult {
  return { data };
}
