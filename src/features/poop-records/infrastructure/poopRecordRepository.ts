import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { poopRecords } from "@/db/schema";
import type { PoopRecordRepository } from "../domain/poopRecordRepository";

/** D1 に保存する `PoopRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createPoopRecordRepository(
  d1?: D1Database,
): PoopRecordRepository {
  const db = getDb(d1);
  return {
    async add(catId, content) {
      const [created] = await db
        .insert(poopRecords)
        .values({ catId, ...content })
        .returning({ id: poopRecords.id });
      return created.id;
    },
    async update(catId, id, content) {
      const result = await db
        .update(poopRecords)
        .set({ ...content, updatedAt: new Date() })
        .where(
          and(
            eq(poopRecords.id, id),
            eq(poopRecords.catId, catId),
            isNull(poopRecords.deletedAt),
          ),
        )
        .returning({ id: poopRecords.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      const result = await db
        .update(poopRecords)
        // 論理削除。削除済みの記録は読み取り・更新から除く
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(poopRecords.id, id),
            eq(poopRecords.catId, catId),
            isNull(poopRecords.deletedAt),
          ),
        )
        .returning({ id: poopRecords.id });
      return result.length > 0;
    },
  };
}
