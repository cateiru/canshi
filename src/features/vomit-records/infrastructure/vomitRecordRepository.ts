import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { vomitRecords } from "@/db/schema";
import type { VomitRecordRepository } from "../domain/vomitRecordRepository";

/** D1 に保存する `VomitRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createVomitRecordRepository(
  d1?: D1Database,
): VomitRecordRepository {
  const db = getDb(d1);
  return {
    async add(catId, content) {
      const [created] = await db
        .insert(vomitRecords)
        .values({ catId, ...content })
        .returning({ id: vomitRecords.id });
      return created.id;
    },
    async update(catId, id, content) {
      const result = await db
        .update(vomitRecords)
        .set({ ...content, updatedAt: new Date() })
        .where(
          and(
            eq(vomitRecords.id, id),
            eq(vomitRecords.catId, catId),
            isNull(vomitRecords.deletedAt),
          ),
        )
        .returning({ id: vomitRecords.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      const result = await db
        .update(vomitRecords)
        // 論理削除。削除済みの記録は読み取り・更新から除く
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(vomitRecords.id, id),
            eq(vomitRecords.catId, catId),
            isNull(vomitRecords.deletedAt),
          ),
        )
        .returning({ id: vomitRecords.id });
      return result.length > 0;
    },
  };
}
