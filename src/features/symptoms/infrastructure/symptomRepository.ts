import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { insertWhere, liveRowCondition } from "@/db/conditionalInsert";
import { insertRecordChangeLog } from "@/db/recordChangeLog";
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
    async add(catId, content, actor) {
      const id = crypto.randomUUID();
      // 関連する通院記録が確認の後に論理削除された場合に、削除済みの記録を指したまま保存しないよう、
      // 挿入の文の中でもこの猫のもので削除されていないことを確かめる
      const [created] = await db.batch([
        insertWhere(
          db,
          symptoms,
          { id, catId, ...content },
          liveRowCondition(hospitalVisits, catId, content.hospitalVisitId),
        ).returning({ id: symptoms.id }),
        // 挿入が断られたときは履歴も追加しない
        insertRecordChangeLog(
          db,
          { recordType: "symptom", recordId: id, action: "create", actor },
          liveRowCondition(symptoms, catId, id),
        ),
      ]);
      return created.length > 0 ? id : null;
    },
    async update(catId, id, content, actor) {
      const [updated] = await db.batch([
        db
          .update(symptoms)
          .set({ ...content, updatedAt: new Date() })
          .where(
            and(
              byId(catId, id),
              liveRowCondition(hospitalVisits, catId, content.hospitalVisitId),
            ),
          )
          .returning({ id: symptoms.id }),
        insertRecordChangeLog(
          db,
          { recordType: "symptom", recordId: id, action: "update", actor },
          and(
            liveRowCondition(symptoms, catId, id),
            liveRowCondition(hospitalVisits, catId, content.hospitalVisitId),
          ),
        ),
      ]);
      return updated.length > 0;
    },
    async remove(catId, id, actor) {
      // 症状は論理削除する。投薬・通院記録から削除済みの症状を指したままにしないよう、
      // それらからの紐付け（medications.symptom_id / hospital_visits.symptom_id）は外す。
      // notifications の reference_id もこの症状を指しうる（`symptom_ongoing`）ため、
      // 確認通知もあわせて削除する。操作の間に別リクエストが割り込まないよう
      // db.batch でまとめて原子的に実行する。ほかの記録の紐付けを外すことは、ほかの記録の編集としては
      // 履歴に残さない。削除の後は症状が条件に一致しないため、履歴を先に追加する
      await db.batch([
        insertRecordChangeLog(
          db,
          { recordType: "symptom", recordId: id, action: "delete", actor },
          liveRowCondition(symptoms, catId, id),
        ),
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
