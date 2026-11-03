import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { poopRecords } from "@/db/schema";
import type { PoopRecordRepository } from "../domain/poopRecordRepository";

/** D1 に保存する `PoopRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createPoopRecordRepository(
  d1?: D1Database,
): PoopRecordRepository {
  const db = getDb(d1);
  return {
    async existsForCat(catId, id) {
      const [row] = await db
        .select({ id: poopRecords.id })
        .from(poopRecords)
        .where(and(eq(poopRecords.id, id), eq(poopRecords.catId, catId)))
        .limit(1);
      return row != null;
    },
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
        .where(and(eq(poopRecords.id, id), eq(poopRecords.catId, catId)))
        .returning({ id: poopRecords.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      const result = await db
        .delete(poopRecords)
        .where(and(eq(poopRecords.id, id), eq(poopRecords.catId, catId)))
        .returning({ id: poopRecords.id });
      return result.length > 0;
    },
  };
}
