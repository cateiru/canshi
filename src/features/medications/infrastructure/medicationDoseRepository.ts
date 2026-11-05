import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { medicationDoses, medications } from "@/db/schema";
import type { MedicationDoseRepository } from "../domain/medicationDoseRepository";

/** D1 に保存する `MedicationDoseRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createMedicationDoseRepository(
  d1?: D1Database,
): MedicationDoseRepository {
  const db = getDb(d1);
  const byId = (catId: string, medicationId: string, id: string) =>
    and(
      eq(medicationDoses.id, id),
      eq(medicationDoses.catId, catId),
      eq(medicationDoses.medicationId, medicationId),
      isNull(medicationDoses.deletedAt),
    );
  return {
    async add(catId, medicationId, content) {
      // 服薬予定がこの猫のもので削除されていないときだけ、INSERT ... SELECT で 1 文で挿入する。
      // INSERT ... SELECT では列の既定値が使われないため ID はここで作り、列はテーブル定義と同じ並びにする
      const [created] = await db
        .insert(medicationDoses)
        .select(
          sql`SELECT ${crypto.randomUUID()}, ${medications.catId}, ${medications.id},
            ${Math.floor(content.occurredAt.getTime() / 1000)},
            ${content.wasAdministered ? 1 : 0}, ${content.memo},
            unixepoch(), unixepoch(), NULL
          FROM ${medications}
          WHERE ${medications.id} = ${medicationId}
            AND ${medications.catId} = ${catId}
            AND ${medications.deletedAt} IS NULL`,
        )
        .returning({ id: medicationDoses.id });
      return created?.id ?? null;
    },
    async update(catId, medicationId, id, content) {
      const result = await db
        .update(medicationDoses)
        .set({ ...content, updatedAt: new Date() })
        .where(byId(catId, medicationId, id))
        .returning({ id: medicationDoses.id });
      return result.length > 0;
    },
    async remove(catId, medicationId, id) {
      const result = await db
        .update(medicationDoses)
        // 論理削除。削除済みの記録は読み取り・更新から除く
        .set({ deletedAt: new Date() })
        .where(byId(catId, medicationId, id))
        .returning({ id: medicationDoses.id });
      return result.length > 0;
    },
  };
}
