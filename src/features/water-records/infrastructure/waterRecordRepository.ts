import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { waterRecords } from "@/db/schema";
import type { WaterRecordRepository } from "../domain/waterRecordRepository";

/** D1 に保存する `WaterRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createWaterRecordRepository(
  d1?: D1Database,
): WaterRecordRepository {
  const db = getDb(d1);
  return {
    async add(catId, content) {
      const [created] = await db
        .insert(waterRecords)
        .values({ catId, ...content })
        .returning({ id: waterRecords.id });
      return created.id;
    },
    async update(catId, id, content) {
      const result = await db
        .update(waterRecords)
        .set({ ...content, updatedAt: new Date() })
        .where(
          and(
            eq(waterRecords.id, id),
            eq(waterRecords.catId, catId),
            isNull(waterRecords.deletedAt),
          ),
        )
        .returning({ id: waterRecords.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      const result = await db
        .update(waterRecords)
        // 論理削除。削除済みの記録は読み取り・更新から除く
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(waterRecords.id, id),
            eq(waterRecords.catId, catId),
            isNull(waterRecords.deletedAt),
          ),
        )
        .returning({ id: waterRecords.id });
      return result.length > 0;
    },
  };
}
