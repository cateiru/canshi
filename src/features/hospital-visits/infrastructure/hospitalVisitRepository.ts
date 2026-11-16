import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  insertWhere,
  liveRowCondition,
  writableCatCondition,
  writableRowCondition,
} from "@/db/conditionalInsert";
import { insertRecordChangeLog } from "@/db/recordChangeLog";
import {
  expenseRecordHospitalVisits,
  hospitalVisits,
  medications,
  symptoms,
} from "@/db/schema";
import { saveHospitalVisitWithExpense } from "@/features/expenses/infrastructure/hospitalVisitExpense";
import type { HospitalVisitRepository } from "../domain/hospitalVisitRepository";

/** D1 に保存する `HospitalVisitRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createHospitalVisitRepository(
  d1?: D1Database,
): HospitalVisitRepository {
  const db = getDb(d1);
  const byId = (catId: string, id: string) =>
    and(
      eq(hospitalVisits.id, id),
      eq(hospitalVisits.catId, catId),
      isNull(hospitalVisits.deletedAt),
      // メモリーへ移した猫の記録は書き換えない
      writableCatCondition(catId),
    );

  // 関連する症状が、この猫のもので削除されていないこと。確認の後に論理削除された場合に、
  // 削除済みの記録を指したまま保存しないよう、書き込みの文の中でも確かめる。
  // あわせて、猫がメモリーへ移されていないことも確かめる（病院代の文にも同じ条件を付ける）
  const canSaveWith = (catId: string, symptomId: string | null) =>
    and(
      writableCatCondition(catId),
      liveRowCondition(symptoms, catId, symptomId),
    );

  return {
    async existsForCat(catId, id) {
      const [row] = await db
        .select({ id: hospitalVisits.id })
        .from(hospitalVisits)
        .where(byId(catId, id))
        .limit(1);
      return row != null;
    },

    async add(catId, content, expense, actor) {
      const id = crypto.randomUUID();
      const saved = await saveHospitalVisitWithExpense(
        db,
        insertWhere(
          db,
          hospitalVisits,
          { id, catId, ...content },
          canSaveWith(catId, content.symptomId),
        ).returning({ id: hospitalVisits.id }),
        // 挿入が断られたときは履歴も追加しない
        insertRecordChangeLog(
          db,
          {
            recordType: "hospital_visit",
            recordId: id,
            action: "create",
            actor,
          },
          writableRowCondition(hospitalVisits, catId, id),
        ),
        {
          hospitalVisitId: id,
          catId,
          visitedAt: content.visitedAt,
          ...expense,
          actor,
        },
        canSaveWith(catId, content.symptomId),
      );
      return saved ? id : null;
    },

    async update(catId, id, content, expense, actor) {
      return saveHospitalVisitWithExpense(
        db,
        db
          .update(hospitalVisits)
          .set({ ...content, updatedAt: new Date() })
          .where(and(byId(catId, id), canSaveWith(catId, content.symptomId)))
          .returning({ id: hospitalVisits.id }),
        insertRecordChangeLog(
          db,
          {
            recordType: "hospital_visit",
            recordId: id,
            action: "update",
            actor,
          },
          and(
            writableRowCondition(hospitalVisits, catId, id),
            canSaveWith(catId, content.symptomId),
          ),
        ),
        {
          hospitalVisitId: id,
          catId,
          visitedAt: content.visitedAt,
          ...expense,
          actor,
        },
        canSaveWith(catId, content.symptomId),
      );
    },

    async remove(catId, id, actor) {
      // 通院記録は論理削除する。症状・投薬・支出記録から削除済みの通院記録を指したままにしないよう、
      // それらからの紐付け（symptoms.hospital_visit_id / medications.hospital_visit_id /
      // expense_record_hospital_visits）は外す。支出記録は家計簿として残す必要があるため、
      // 紐付けだけ外して記録自体は削除しない。一連の操作は db.batch でまとめて
      // 原子的に実行する。ほかの記録の紐付けを外すことは、ほかの記録の編集としては履歴に残さない。
      // 削除の後は通院記録が条件に一致しないため、履歴を先に追加する。
      // どの文も、通院記録を削除できるとき（猫がメモリーへ移されていないときなど）だけ行う
      const removable = writableRowCondition(hospitalVisits, catId, id);
      const [, , , , deleted] = await db.batch([
        insertRecordChangeLog(
          db,
          {
            recordType: "hospital_visit",
            recordId: id,
            action: "delete",
            actor,
          },
          removable,
        ),
        db
          .update(symptoms)
          .set({ hospitalVisitId: null })
          .where(
            and(
              eq(symptoms.hospitalVisitId, id),
              eq(symptoms.catId, catId),
              removable,
            ),
          ),
        db
          .update(medications)
          .set({ hospitalVisitId: null })
          .where(
            and(
              eq(medications.hospitalVisitId, id),
              eq(medications.catId, catId),
              removable,
            ),
          ),
        db
          .delete(expenseRecordHospitalVisits)
          .where(
            and(eq(expenseRecordHospitalVisits.hospitalVisitId, id), removable),
          ),
        db
          .update(hospitalVisits)
          .set({ deletedAt: new Date() })
          .where(byId(catId, id))
          .returning({ id: hospitalVisits.id }),
      ]);
      return deleted.length > 0;
    },
  };
}
