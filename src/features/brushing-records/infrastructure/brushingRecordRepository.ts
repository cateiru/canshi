import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { brushingRecords } from "@/db/schema";
import type { BrushingRecordRepository } from "../domain/brushingRecordRepository";

/** D1 に保存する `BrushingRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createBrushingRecordRepository(
  d1?: D1Database,
): BrushingRecordRepository {
  const db = getDb(d1);
  return {
    async add(catId, content) {
      const [created] = await db
        .insert(brushingRecords)
        .values({ catId, ...content })
        .returning({ id: brushingRecords.id });
      return created.id;
    },
    async update(catId, id, content) {
      const result = await db
        .update(brushingRecords)
        .set({ ...content, updatedAt: new Date() })
        .where(
          and(
            eq(brushingRecords.id, id),
            eq(brushingRecords.catId, catId),
            isNull(brushingRecords.deletedAt),
          ),
        )
        .returning({ id: brushingRecords.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      const result = await db
        .update(brushingRecords)
        // 論理削除。削除済みの記録は読み取り・更新から除く
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(brushingRecords.id, id),
            eq(brushingRecords.catId, catId),
            isNull(brushingRecords.deletedAt),
          ),
        )
        .returning({ id: brushingRecords.id });
      return result.length > 0;
    },
  };
}
