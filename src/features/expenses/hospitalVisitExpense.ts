import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { getDb } from "@/db/client";
import {
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
} from "@/db/schema";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import {
  combineDateTimeUtc,
  splitDateTimeUtc,
} from "@/features/shared/datetime";
import { EXPENSE_MEDIA_TYPE } from "./media";
import { deleteExpenseStatements } from "./storage";

export type SyncHospitalVisitExpenseParams = {
  hospitalVisitId: string;
  catId: string;
  /** 通院記録の受診日時。支出日は同じ日付の 00:00 に揃える */
  visitedAt: Date;
  /** 病院代。null のときは紐付く支出記録を削除する（他の通院記録と共有していれば紐付けだけ外す） */
  amountYen: number | null;
  /**
   * 病院代を入力せずに、既存の支出記録（同じ日の「病院」）へ紐付けるときの支出記録 ID。
   * 存在・カテゴリ・日付の確認は呼び出し元で行う。病院代を入力した場合は使わない
   */
  linkExpenseRecordId?: string | null;
};

/**
 * 通院記録と病院代を同じ batch で保存し、片方だけが保存されることを防ぐ。
 * 金額を入力したら作成、変更したら更新、空にしたら削除する。
 * メモ・関連する猫は支出記録側で自由に変更できるため、
 * 既存の支出記録を更新するときは金額と支出日だけを上書きする。
 *
 * 一度の通院で複数の猫を診てもらった場合など、1 件の支出記録を複数の通院記録で
 * 共有していることがある。その場合は他の通院記録の病院代でもあるため、
 * 空にしても支出記録は削除せずこの通院記録との紐付けだけを外し、
 * 受診日を変えても支出日は変えない
 */
export async function saveHospitalVisitWithExpense(
  db: ReturnType<typeof getDb>,
  visitStatement: BatchItem<"sqlite">,
  {
    hospitalVisitId,
    catId,
    visitedAt,
    amountYen,
    linkExpenseRecordId,
  }: SyncHospitalVisitExpenseParams,
): Promise<void> {
  const [existing] = await db
    .select({ id: expenseRecordHospitalVisits.expenseRecordId })
    .from(expenseRecordHospitalVisits)
    .where(eq(expenseRecordHospitalVisits.hospitalVisitId, hospitalVisitId))
    .limit(1);
  const isShared =
    existing != null &&
    (
      await db
        .select({ id: expenseRecordHospitalVisits.hospitalVisitId })
        .from(expenseRecordHospitalVisits)
        .where(eq(expenseRecordHospitalVisits.expenseRecordId, existing.id))
        .limit(2)
    ).length > 1;
  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
    visitStatement,
  ];

  if (amountYen == null) {
    if (existing != null && isShared) {
      statements.push(
        db
          .delete(expenseRecordHospitalVisits)
          .where(
            and(
              eq(expenseRecordHospitalVisits.expenseRecordId, existing.id),
              eq(expenseRecordHospitalVisits.hospitalVisitId, hospitalVisitId),
            ),
          ),
      );
    } else if (existing != null) {
      // メディアは DB 外にあるため、既存の削除規約に従って先に片付ける。
      await deleteMediaAssetsByRecord(EXPENSE_MEDIA_TYPE, existing.id);
      statements.push(...deleteExpenseStatements(db, existing.id));
    } else if (linkExpenseRecordId != null) {
      statements.push(
        db.insert(expenseRecordHospitalVisits).values({
          expenseRecordId: linkExpenseRecordId,
          hospitalVisitId,
        }),
        // 支出記録の「{猫名}のみ」の絞り込みやタイムラインに出るよう、通院した猫も関連付ける
        db
          .insert(expenseRecordCats)
          .values({ expenseRecordId: linkExpenseRecordId, catId })
          .onConflictDoNothing(),
      );
    }
    await db.batch(statements);
    return;
  }

  const spentAt = combineDateTimeUtc(splitDateTimeUtc(visitedAt).date, "00:00");

  if (existing != null) {
    statements.push(
      db
        .update(expenseRecords)
        .set(
          isShared
            ? { amountYen, updatedAt: new Date() }
            : { amountYen, spentAt, updatedAt: new Date() },
        )
        .where(eq(expenseRecords.id, existing.id)),
    );
  } else {
    const id = crypto.randomUUID();
    statements.push(
      db.insert(expenseRecords).values({
        id,
        spentAt,
        amountYen,
        // 通院由来の支出は既定で「病院」。支出記録の編集で後から変更できる
        category: "hospital",
      }),
      db.insert(expenseRecordHospitalVisits).values({
        expenseRecordId: id,
        hospitalVisitId,
      }),
      db.insert(expenseRecordCats).values({ expenseRecordId: id, catId }),
    );
  }
  await db.batch(statements);
}
