import { and, eq, exists, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { insertRecordChangeLog } from "@/db/recordChangeLog";
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
  // 投薬実績が削除されずにあること。履歴の文を、記録の文と同じ条件で通すために使う
  const doseIsLive = (catId: string, medicationId: string, id: string) =>
    exists(
      db
        .select({ id: medicationDoses.id })
        .from(medicationDoses)
        .where(byId(catId, medicationId, id)),
    );
  return {
    async add(catId, medicationId, content, actor) {
      const id = crypto.randomUUID();
      // 服薬予定がこの猫のもので削除されていないときだけ、INSERT ... SELECT で 1 文で挿入する。
      // INSERT ... SELECT では列の既定値が使われないため ID はここで作り、列はテーブル定義と同じ並びにする
      const [created] = await db.batch([
        db
          .insert(medicationDoses)
          .select(
            sql`SELECT ${id}, ${medications.catId}, ${medications.id},
            ${Math.floor(content.occurredAt.getTime() / 1000)},
            ${content.wasAdministered ? 1 : 0}, ${content.memo},
            unixepoch(), unixepoch(), NULL
          FROM ${medications}
          WHERE ${medications.id} = ${medicationId}
            AND ${medications.catId} = ${catId}
            AND ${medications.deletedAt} IS NULL`,
          )
          .returning({ id: medicationDoses.id }),
        // 挿入が断られたときは履歴も追加しない
        insertRecordChangeLog(
          db,
          {
            recordType: "medication_dose",
            recordId: id,
            action: "create",
            actor,
          },
          doseIsLive(catId, medicationId, id),
        ),
      ]);
      return created.length > 0 ? id : null;
    },
    async update(catId, medicationId, id, content, actor) {
      const [updated] = await db.batch([
        db
          .update(medicationDoses)
          .set({ ...content, updatedAt: new Date() })
          .where(byId(catId, medicationId, id))
          .returning({ id: medicationDoses.id }),
        insertRecordChangeLog(
          db,
          {
            recordType: "medication_dose",
            recordId: id,
            action: "update",
            actor,
          },
          doseIsLive(catId, medicationId, id),
        ),
      ]);
      return updated.length > 0;
    },
    async remove(catId, medicationId, id, actor) {
      // 削除の後は記録が条件に一致しないため、履歴を先に追加する
      const [, deleted] = await db.batch([
        insertRecordChangeLog(
          db,
          {
            recordType: "medication_dose",
            recordId: id,
            action: "delete",
            actor,
          },
          doseIsLive(catId, medicationId, id),
        ),
        db
          .update(medicationDoses)
          // 論理削除。削除済みの記録は読み取り・更新から除く
          .set({ deletedAt: new Date() })
          .where(byId(catId, medicationId, id))
          .returning({ id: medicationDoses.id }),
      ]);
      return deleted.length > 0;
    },
  };
}
