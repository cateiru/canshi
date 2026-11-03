import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { memoRecords } from "@/db/schema";
import type { MemoRecordRepository } from "../domain/memoRecordRepository";

/** D1 に保存する `MemoRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createMemoRecordRepository(
  d1?: D1Database,
): MemoRecordRepository {
  const db = getDb(d1);
  return {
    async existsForCat(catId, id) {
      const [row] = await db
        .select({ id: memoRecords.id })
        .from(memoRecords)
        .where(and(eq(memoRecords.id, id), eq(memoRecords.catId, catId)))
        .limit(1);
      return row != null;
    },
    async add(catId, content) {
      const [created] = await db
        .insert(memoRecords)
        .values({ catId, ...content })
        .returning({ id: memoRecords.id });
      return created.id;
    },
    async update(catId, id, content) {
      const result = await db
        .update(memoRecords)
        .set({ ...content, updatedAt: new Date() })
        .where(and(eq(memoRecords.id, id), eq(memoRecords.catId, catId)))
        .returning({ id: memoRecords.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      const result = await db
        .delete(memoRecords)
        .where(and(eq(memoRecords.id, id), eq(memoRecords.catId, catId)))
        .returning({ id: memoRecords.id });
      return result.length > 0;
    },
  };
}
