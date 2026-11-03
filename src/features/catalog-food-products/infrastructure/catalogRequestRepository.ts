import { and, count, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { catalogFoodProductRequests, notifications, users } from "@/db/schema";
import type { CatalogRequestRepository } from "../domain/catalogRequestRepository";

/** D1 に保存する `CatalogRequestRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createCatalogRequestRepository(
  d1?: D1Database,
): CatalogRequestRepository {
  const db = getDb(d1);
  return {
    async existsOpen(userId, searchQuery) {
      const [row] = await db
        .select({ id: catalogFoodProductRequests.id })
        .from(catalogFoodProductRequests)
        .where(
          and(
            eq(catalogFoodProductRequests.userId, userId),
            eq(catalogFoodProductRequests.searchQuery, searchQuery),
            isNull(catalogFoodProductRequests.completedAt),
          ),
        )
        .limit(1);
      return row != null;
    },

    async addWithinLimit(userId, searchQuery, label, maxOpen) {
      const openCount = db
        .select({ openCount: count() })
        .from(catalogFoodProductRequests)
        .where(
          and(
            eq(catalogFoodProductRequests.userId, userId),
            isNull(catalogFoodProductRequests.completedAt),
          ),
        );
      // INSERT ... SELECT では `$defaultFn` や SQL の既定値が効かないため、全カラムの値を
      // テーブル定義の順に明示する（`complete` と同じ方式）。同じ条件の未完了のリクエストは
      // 一意インデックスで、同時に送られたときも 1 件にする
      const created = await db
        .insert(catalogFoodProductRequests)
        .select(
          db
            .select({
              id: sql`${crypto.randomUUID()}`.as("id"),
              userId: users.id,
              searchQuery: sql`${searchQuery}`.as("searchQuery"),
              label: sql`${label}`.as("label"),
              completedAt: sql`null`.as("completedAt"),
              createdAt: sql`(unixepoch())`.as("createdAt"),
            })
            .from(users)
            .where(and(eq(users.id, userId), sql`(${openCount}) < ${maxOpen}`)),
        )
        .onConflictDoNothing()
        .returning({ id: catalogFoodProductRequests.id });
      return created.length > 0;
    },

    async findById(id) {
      const [request] = await db
        .select()
        .from(catalogFoodProductRequests)
        .where(eq(catalogFoodProductRequests.id, id))
        .limit(1);
      return request ?? null;
    },

    async complete(id, notification) {
      // 同時に完了にされても、通知は重複を防ぐキーで 1 件にする。
      // INSERT ... SELECT では `$defaultFn` や SQL の既定値が効かないため、全カラムの値を
      // テーブル定義の順に明示する（`insertSymptomOngoingNotification` と同じ方式）
      const [, completed] = await db.batch([
        db
          .insert(notifications)
          .select(
            db
              .select({
                id: sql`${crypto.randomUUID()}`.as("id"),
                catId: sql`null`.as("catId"),
                householdId: sql`null`.as("householdId"),
                userId: catalogFoodProductRequests.userId,
                kind: sql`'catalog_request_completed'`.as("kind"),
                referenceId: catalogFoodProductRequests.id,
                dedupeKey: sql`${notification.dedupeKey}`.as("dedupeKey"),
                title: sql`${notification.title}`.as("title"),
                body: sql`${notification.body}`.as("body"),
                url: sql`${notification.url}`.as("url"),
                dueAt: sql`(unixepoch())`.as("dueAt"),
                status: sql`'pending'`.as("status"),
                snoozedUntil: sql`null`.as("snoozedUntil"),
                readAt: sql`null`.as("readAt"),
                pushedAt: sql`null`.as("pushedAt"),
                createdAt: sql`(unixepoch())`.as("createdAt"),
                updatedAt: sql`(unixepoch())`.as("updatedAt"),
              })
              .from(catalogFoodProductRequests)
              .where(
                and(
                  eq(catalogFoodProductRequests.id, id),
                  isNull(catalogFoodProductRequests.completedAt),
                ),
              ),
          )
          .onConflictDoNothing({ target: notifications.dedupeKey }),
        db
          .update(catalogFoodProductRequests)
          .set({ completedAt: sql`(unixepoch())` })
          .where(
            and(
              eq(catalogFoodProductRequests.id, id),
              isNull(catalogFoodProductRequests.completedAt),
            ),
          )
          .returning({ id: catalogFoodProductRequests.id }),
      ]);
      return completed.length > 0;
    },
  };
}
