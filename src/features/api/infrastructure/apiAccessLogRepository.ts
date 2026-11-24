import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { insertWhere } from "@/db/conditionalInsert";
import { apiAccessLogs, apiTokens } from "@/db/schema";
import type { ApiAccessLogRepository } from "../domain/apiAccessLogRepository";

/** D1 に保存する `ApiAccessLogRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createApiAccessLogRepository(
  d1?: D1Database,
): ApiAccessLogRepository {
  const db = getDb(d1);
  return {
    async add(apiTokenId, content, accessedAt) {
      await insertWhere(
        db,
        apiAccessLogs,
        { apiTokenId, ...content, createdAt: accessedAt },
        sql`EXISTS (
          SELECT 1 FROM ${apiTokens} WHERE ${apiTokens.id} = ${apiTokenId}
        )`,
      );
    },
  };
}
