import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { shampooRecords } from "@/db/schema";
import type { ShampooRecordRepository } from "../domain/shampooRecordRepository";

/** D1 に保存する `ShampooRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createShampooRecordRepository(
  d1?: D1Database,
): ShampooRecordRepository {
  const db = getDb(d1);
  return {
    async add(catId, content) {
      const [created] = await db
        .insert(shampooRecords)
        .values({ catId, ...content })
        .returning({ id: shampooRecords.id });
      return created.id;
    },
    async update(catId, id, content) {
      const result = await db
        .update(shampooRecords)
        .set({ ...content, updatedAt: new Date() })
        .where(
          and(
            eq(shampooRecords.id, id),
            eq(shampooRecords.catId, catId),
            isNull(shampooRecords.deletedAt),
          ),
        )
        .returning({ id: shampooRecords.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      const result = await db
        .update(shampooRecords)
        // 論理削除。削除済みの記録は読み取り・更新から除く
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(shampooRecords.id, id),
            eq(shampooRecords.catId, catId),
            isNull(shampooRecords.deletedAt),
          ),
        )
        .returning({ id: shampooRecords.id });
      return result.length > 0;
    },
  };
}
