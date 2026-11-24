import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { apiAccessLogs, apiTokens } from "@/db/schema";
import { withoutMemorialCats } from "@/features/external-access/infrastructure/permissions";
import type { ApiTokenRepository } from "../domain/apiTokenRepository";

/** D1 に保存する `ApiTokenRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createApiTokenRepository(d1?: D1Database): ApiTokenRepository {
  const db = getDb(d1);
  const ownedBy = (userId: string, id: string) =>
    and(eq(apiTokens.id, id), eq(apiTokens.userId, userId));
  // 範囲を保存する batch の最後で、その時点でメモリーへ移している猫の書き込みの許可を外す
  // （`withoutMemorialCats` 参照）
  const removeMemorialCats = (userId: string, id: string) =>
    db
      .update(apiTokens)
      .set({
        writableRecordTypes: withoutMemorialCats(apiTokens.writableRecordTypes),
      })
      .where(ownedBy(userId, id));
  return {
    async add(userId, { permissions, ...content }) {
      const id = crypto.randomUUID();
      await db.batch([
        db.insert(apiTokens).values({ id, userId, ...content, ...permissions }),
        removeMemorialCats(userId, id),
      ]);
      return id;
    },

    async updatePermissions(userId, id, permissions) {
      const [updated] = await db.batch([
        db
          .update(apiTokens)
          .set({ ...permissions, updatedAt: new Date() })
          .where(ownedBy(userId, id))
          .returning({ id: apiTokens.id }),
        removeMemorialCats(userId, id),
      ]);
      return updated.length > 0;
    },

    async remove(userId, id) {
      // 履歴がトークンを外部キーで参照しているため、先に履歴を消す
      const [, deleted] = await db.batch([
        db
          .delete(apiAccessLogs)
          .where(
            inArray(
              apiAccessLogs.apiTokenId,
              db
                .select({ id: apiTokens.id })
                .from(apiTokens)
                .where(ownedBy(userId, id)),
            ),
          ),
        db
          .delete(apiTokens)
          .where(ownedBy(userId, id))
          .returning({ id: apiTokens.id }),
      ]);
      return deleted.length > 0;
    },
  };
}
