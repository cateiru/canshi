import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { weightRecords } from "@/db/schema";
import type { WeightRecordRepository } from "../domain/weightRecordRepository";

/** D1 に保存する `WeightRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createWeightRecordRepository(
  d1?: D1Database,
): WeightRecordRepository {
  const db = getDb(d1);
  return {
    async add(catId, content) {
      const [created] = await db
        .insert(weightRecords)
        .values({ catId, ...content })
        .returning({ id: weightRecords.id });
      return created.id;
    },
    async update(catId, id, content) {
      const result = await db
        .update(weightRecords)
        .set({ ...content, updatedAt: new Date() })
        .where(
          and(
            eq(weightRecords.id, id),
            eq(weightRecords.catId, catId),
            isNull(weightRecords.deletedAt),
          ),
        )
        .returning({ id: weightRecords.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      const result = await db
        .update(weightRecords)
        // 論理削除。削除済みの記録は読み取り・更新から除く
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(weightRecords.id, id),
            eq(weightRecords.catId, catId),
            isNull(weightRecords.deletedAt),
          ),
        )
        .returning({ id: weightRecords.id });
      return result.length > 0;
    },
  };
}
