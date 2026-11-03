import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { vomitRecords } from "@/db/schema";
import type { VomitRecordRepository } from "../domain/vomitRecordRepository";

/** D1 に保存する `VomitRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createVomitRecordRepository(
  d1?: D1Database,
): VomitRecordRepository {
  const db = getDb(d1);
  return {
    async existsForCat(catId, id) {
      const [row] = await db
        .select({ id: vomitRecords.id })
        .from(vomitRecords)
        .where(and(eq(vomitRecords.id, id), eq(vomitRecords.catId, catId)))
        .limit(1);
      return row != null;
    },
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
        .where(and(eq(vomitRecords.id, id), eq(vomitRecords.catId, catId)))
        .returning({ id: vomitRecords.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      const result = await db
        .delete(vomitRecords)
        .where(and(eq(vomitRecords.id, id), eq(vomitRecords.catId, catId)))
        .returning({ id: vomitRecords.id });
      return result.length > 0;
    },
  };
}
