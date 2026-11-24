import type { ZodRawShape, z } from "zod";
import { registerOperations } from "@/features/external-access/presentation/operations";
import type {
  OperationCaller,
  OperationContext,
} from "@/features/external-access/presentation/operations/context";
import type {
  OperationConfig,
  OperationRegistry,
  OperationResult,
} from "@/features/external-access/presentation/operations/registry";
import { API_ROUTES } from "../domain/routes";

/** メッセージに使う、API トークンの呼び方 */
export const API_CALLER: OperationCaller = {
  name: "このトークン",
  settings: "設定の「外部接続」の「APIトークン」",
  howToAllow:
    "CANSHI の設定の「外部接続」の「APIトークン」で、トークンに許可してください",
};

/** API から呼ぶ操作 */
export interface ApiOperation {
  config: OperationConfig<ZodRawShape>;
  /** 引数は、呼び出す前に `config.inputSchema` で検証しておく */
  call(args: Record<string, unknown>): Promise<OperationResult>;
}

/** 操作を、名前で引けるように集める */
export function collectApiOperations(
  ctx: OperationContext,
): Map<string, ApiOperation> {
  const operations = new Map<string, ApiOperation>();
  const registry: OperationRegistry = {
    register<TShape extends ZodRawShape>(
      name: string,
      config: OperationConfig<TShape>,
      handler: (
        args: z.output<z.ZodObject<TShape>>,
      ) => Promise<OperationResult>,
    ) {
      operations.set(name, {
        config,
        call: (args) => handler(args as z.output<z.ZodObject<TShape>>),
      });
    },
  };
  registerOperations(registry, ctx);
  return operations;
}

const ENDPOINT_BY_OPERATION = new Map(
  API_ROUTES.map((route) => [route.operation, `${route.method} ${route.path}`]),
);

/**
 * 操作の説明・エラーのメッセージに含まれる操作の名前（`list_cats` など）を、API のエンドポイント
 * （`GET /cats` など）に置き換える。操作は AI との接続と共通で、MCP のツールの名前で書かれているため
 */
export function toEndpointText(text: string): string {
  return text.replace(
    /\b[a-z]+(?:_[a-z]+)+\b/g,
    (name) => ENDPOINT_BY_OPERATION.get(name) ?? name,
  );
}
