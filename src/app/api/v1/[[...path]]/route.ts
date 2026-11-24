import { getCloudflareContext } from "@opennextjs/cloudflare";
import { after } from "next/server";
import { handleApiRequest } from "@/features/api/presentation/handler";

export const dynamic = "force-dynamic";

/**
 * 外部のプログラムから使う API。エンドポイントは `src/features/api/domain/routes.ts` にまとめ、
 * トークンの認証を含めて `handleApiRequest` で処理する（middleware ではセッションを確認しない）
 */
function handler(request: Request) {
  return handleApiRequest(request, {
    env: getCloudflareContext().env,
    defer: (task) => after(task),
  });
}

export {
  handler as DELETE,
  handler as GET,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
