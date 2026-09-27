import {
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { expenseRecords } from "./expense-records";
import { hospitalVisits } from "./hospital-visits";

/**
 * 支出記録（病院代）と通院記録の紐付け。一度の通院で複数の猫を診てもらい、まとめて
 * 支払うことがあるため、1 件の支出に複数の通院記録を紐付けられる。
 * 通院記録の「病院代」は 1 つの金額しか持たないため、1 件の通院記録に紐付く支出は
 * 最大 1 件に制限する（`hospital_visit_id` の一意インデックス）
 */
export const expenseRecordHospitalVisits = sqliteTable(
  "expense_record_hospital_visits",
  {
    expenseRecordId: text("expense_record_id")
      .notNull()
      .references(() => expenseRecords.id),
    hospitalVisitId: text("hospital_visit_id")
      .notNull()
      .references(() => hospitalVisits.id),
  },
  (table) => [
    primaryKey({ columns: [table.expenseRecordId, table.hospitalVisitId] }),
    uniqueIndex("expense_record_hospital_visits_hospital_visit_id_unique").on(
      table.hospitalVisitId,
    ),
  ],
);

export type ExpenseRecordHospitalVisit =
  typeof expenseRecordHospitalVisits.$inferSelect;
export type NewExpenseRecordHospitalVisit =
  typeof expenseRecordHospitalVisits.$inferInsert;
