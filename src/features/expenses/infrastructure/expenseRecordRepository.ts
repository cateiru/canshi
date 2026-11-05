import { and, eq, inArray, isNull } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  cats,
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
  hospitalVisits,
} from "@/db/schema";
import { householdCatIdsQuery } from "@/features/households/infrastructure/queries";
import type { HospitalVisitLinkCandidate } from "../domain/expenseRecord";
import type { ExpenseRecordRepository } from "../domain/expenseRecordRepository";
import {
  deleteExpenseStatements,
  insertExpenseCats,
  insertExpenseHospitalVisits,
  liveExpenseCondition,
} from "./storage";

/** D1 に保存する `ExpenseRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createExpenseRecordRepository(
  d1?: D1Database,
): ExpenseRecordRepository {
  const db = getDb(d1);
  const inHousehold = (householdId: string, id: string) =>
    and(
      eq(expenseRecords.id, id),
      eq(expenseRecords.householdId, householdId),
      isNull(expenseRecords.deletedAt),
    );

  return {
    async findForHousehold(householdId, id) {
      const [row] = await db
        .select({
          id: expenseRecords.id,
          category: expenseRecords.category,
          spentAt: expenseRecords.spentAt,
        })
        .from(expenseRecords)
        .where(inHousehold(householdId, id))
        .limit(1);
      return row ?? null;
    },

    async findHospitalVisitLinkCandidates(householdId, hospitalVisitIds) {
      const candidates: HospitalVisitLinkCandidate[] = [];
      // householdId の分を 1 個予約する
      for (const ids of chunkForBoundParameters(hospitalVisitIds, 1)) {
        const rows = await db
          .select({
            catId: hospitalVisits.catId,
            visitedAt: hospitalVisits.visitedAt,
            expenseRecordId: expenseRecordHospitalVisits.expenseRecordId,
          })
          .from(hospitalVisits)
          .leftJoin(
            expenseRecordHospitalVisits,
            eq(expenseRecordHospitalVisits.hospitalVisitId, hospitalVisits.id),
          )
          .where(
            and(
              inArray(hospitalVisits.id, ids),
              isNull(hospitalVisits.deletedAt),
              inArray(
                hospitalVisits.catId,
                householdCatIdsQuery(db, householdId),
              ),
            ),
          );
        candidates.push(...rows);
      }
      return candidates;
    },

    async allCatsInHousehold(householdId, catIds) {
      // householdId の分を 1 個予約する
      for (const ids of chunkForBoundParameters(catIds, 1)) {
        const rows = await db
          .select({ id: cats.id })
          .from(cats)
          .where(and(inArray(cats.id, ids), eq(cats.householdId, householdId)));
        if (rows.length !== ids.length) return false;
      }
      return true;
    },

    async add(householdId, content, links) {
      const id = crypto.randomUUID();
      await db.batch([
        db.insert(expenseRecords).values({ id, householdId, ...content }),
        ...insertExpenseCats(db, id, links.catIds),
        ...insertExpenseHospitalVisits(db, id, links.hospitalVisitIds),
      ]);
      return id;
    },

    async update(householdId, id, content, links) {
      // 紐付く猫・通院記録は差分更新せず、いったん削除してから選択されたものを入れ直す。
      // 紐付けられるのは支出と同じ家の猫・通院記録だけのため、すべてフォームの選択肢に含まれる
      await db.batch([
        db
          .update(expenseRecords)
          .set({ ...content, updatedAt: new Date() })
          .where(inHousehold(householdId, id)),
        // 支出が確認の後に論理削除された場合は、紐付けも入れ直さない
        db
          .delete(expenseRecordCats)
          .where(
            and(
              eq(expenseRecordCats.expenseRecordId, id),
              liveExpenseCondition(id),
            ),
          ),
        db
          .delete(expenseRecordHospitalVisits)
          .where(
            and(
              eq(expenseRecordHospitalVisits.expenseRecordId, id),
              liveExpenseCondition(id),
            ),
          ),
        ...insertExpenseCats(db, id, links.catIds),
        ...insertExpenseHospitalVisits(db, id, links.hospitalVisitIds),
      ]);
    },

    async remove(id) {
      await db.batch(deleteExpenseStatements(db, id));
    },
  };
}
