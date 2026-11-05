import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { insertWhere, liveRowCondition } from "@/db/conditionalInsert";
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
    );

  // 関連する症状が、この猫のもので削除されていないこと。確認の後に論理削除された場合に、
  // 削除済みの記録を指したまま保存しないよう、書き込みの文の中でも確かめる
  const symptomIsLive = (catId: string, symptomId: string | null) =>
    liveRowCondition(symptoms, catId, symptomId);

  return {
    async existsForCat(catId, id) {
      const [row] = await db
        .select({ id: hospitalVisits.id })
        .from(hospitalVisits)
        .where(byId(catId, id))
        .limit(1);
      return row != null;
    },

    async add(catId, content, expense) {
      const id = crypto.randomUUID();
      const saved = await saveHospitalVisitWithExpense(
        db,
        insertWhere(
          db,
          hospitalVisits,
          { id, catId, ...content },
          symptomIsLive(catId, content.symptomId),
        ).returning({ id: hospitalVisits.id }),
        {
          hospitalVisitId: id,
          catId,
          visitedAt: content.visitedAt,
          ...expense,
        },
        symptomIsLive(catId, content.symptomId),
      );
      return saved ? id : null;
    },

    async update(catId, id, content, expense) {
      return saveHospitalVisitWithExpense(
        db,
        db
          .update(hospitalVisits)
          .set({ ...content, updatedAt: new Date() })
          .where(and(byId(catId, id), symptomIsLive(catId, content.symptomId)))
          .returning({ id: hospitalVisits.id }),
        {
          hospitalVisitId: id,
          catId,
          visitedAt: content.visitedAt,
          ...expense,
        },
        symptomIsLive(catId, content.symptomId),
      );
    },

    async remove(catId, id) {
      // 通院記録は論理削除する。症状・投薬・支出記録から削除済みの通院記録を指したままにしないよう、
      // それらからの紐付け（symptoms.hospital_visit_id / medications.hospital_visit_id /
      // expense_record_hospital_visits）は外す。支出記録は家計簿として残す必要があるため、
      // 紐付けだけ外して記録自体は削除しない。一連の操作は db.batch でまとめて
      // 原子的に実行する
      await db.batch([
        db
          .update(symptoms)
          .set({ hospitalVisitId: null })
          .where(
            and(eq(symptoms.hospitalVisitId, id), eq(symptoms.catId, catId)),
          ),
        db
          .update(medications)
          .set({ hospitalVisitId: null })
          .where(
            and(
              eq(medications.hospitalVisitId, id),
              eq(medications.catId, catId),
            ),
          ),
        db
          .delete(expenseRecordHospitalVisits)
          .where(eq(expenseRecordHospitalVisits.hospitalVisitId, id)),
        db
          .update(hospitalVisits)
          .set({ deletedAt: new Date() })
          .where(byId(catId, id)),
      ]);
    },
  };
}
