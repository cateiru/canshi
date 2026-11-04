import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { medicationDoses, medications } from "@/db/schema";
import type { MedicationRepository } from "../domain/medicationRepository";

/** D1 に保存する `MedicationRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createMedicationRepository(
  d1?: D1Database,
): MedicationRepository {
  const db = getDb(d1);
  const byId = (catId: string, id: string) =>
    and(
      eq(medications.id, id),
      eq(medications.catId, catId),
      isNull(medications.deletedAt),
    );
  return {
    async existsForCat(catId, id) {
      const [row] = await db
        .select({ id: medications.id })
        .from(medications)
        .where(byId(catId, id))
        .limit(1);
      return row != null;
    },
    async add(catId, content) {
      const [created] = await db
        .insert(medications)
        .values({ catId, ...content })
        .returning({ id: medications.id });
      return created.id;
    },
    async update(catId, id, content) {
      const result = await db
        .update(medications)
        .set({ ...content, updatedAt: new Date() })
        .where(byId(catId, id))
        .returning({ id: medications.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      // 服薬予定と、その投薬実績をまとめて論理削除する。2つの更新の間に別リクエストが
      // 割り込まないよう、D1 の batch で原子的に実行する
      const deletedAt = new Date();
      await db.batch([
        db
          .update(medicationDoses)
          .set({ deletedAt })
          .where(
            and(
              eq(medicationDoses.medicationId, id),
              eq(medicationDoses.catId, catId),
              isNull(medicationDoses.deletedAt),
            ),
          ),
        db.update(medications).set({ deletedAt }).where(byId(catId, id)),
      ]);
    },
    async setArchivedAt(catId, id, archivedAt) {
      await db
        .update(medications)
        .set({ archivedAt, updatedAt: new Date() })
        .where(byId(catId, id));
    },
  };
}
