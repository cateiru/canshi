import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  hospitalVisits,
  medications,
  notifications,
  symptoms,
} from "@/db/schema";
import type { SymptomRepository } from "../domain/symptomRepository";

/** D1 に保存する `SymptomRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createSymptomRepository(d1?: D1Database): SymptomRepository {
  const db = getDb(d1);
  const byId = (catId: string, id: string) =>
    and(
      eq(symptoms.id, id),
      eq(symptoms.catId, catId),
      isNull(symptoms.deletedAt),
    );
  return {
    async existsForCat(catId, id) {
      const [row] = await db
        .select({ id: symptoms.id })
        .from(symptoms)
        .where(byId(catId, id))
        .limit(1);
      return row != null;
    },
    async add(catId, content) {
      const [created] = await db
        .insert(symptoms)
        .values({ catId, ...content })
        .returning({ id: symptoms.id });
      return created.id;
    },
    async update(catId, id, content) {
      const result = await db
        .update(symptoms)
        .set({ ...content, updatedAt: new Date() })
        .where(byId(catId, id))
        .returning({ id: symptoms.id });
      return result.length > 0;
    },
    async remove(catId, id) {
      // 症状は論理削除する。投薬・通院記録から削除済みの症状を指したままにしないよう、
      // それらからの紐付け（medications.symptom_id / hospital_visits.symptom_id）は外す。
      // notifications の reference_id もこの症状を指しうる（`symptom_ongoing`）ため、
      // 確認通知もあわせて削除する。操作の間に別リクエストが割り込まないよう
      // db.batch でまとめて原子的に実行する
      await db.batch([
        db
          .update(medications)
          .set({ symptomId: null, updatedAt: new Date() })
          .where(
            and(eq(medications.symptomId, id), eq(medications.catId, catId)),
          ),
        db
          .update(hospitalVisits)
          .set({ symptomId: null })
          .where(
            and(
              eq(hospitalVisits.symptomId, id),
              eq(hospitalVisits.catId, catId),
            ),
          ),
        db
          .delete(notifications)
          .where(
            and(
              eq(notifications.kind, "symptom_ongoing"),
              eq(notifications.referenceId, id),
              eq(notifications.catId, catId),
            ),
          ),
        db
          .update(symptoms)
          .set({ deletedAt: new Date() })
          .where(byId(catId, id)),
      ]);
    },
  };
}
