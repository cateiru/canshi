import { eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { getDb } from "@/db/client";
import { expenseRecordCats, expenseRecords } from "@/db/schema";
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
  /** 病院代。null のときは紐付く支出記録を削除する */
  amountYen: number | null;
};

/**
 * 通院記録と病院代を同じ batch で保存し、片方だけが保存されることを防ぐ。
 * 金額を入力したら作成、変更したら更新、空にしたら削除する。
 * カテゴリ・メモ・関連する猫は支出記録側で自由に変更できるため、
 * 既存の支出記録を更新するときは金額と支出日だけを上書きする
 */
export async function saveHospitalVisitWithExpense(
  db: ReturnType<typeof getDb>,
  visitStatement: BatchItem<"sqlite">,
  {
    hospitalVisitId,
    catId,
    visitedAt,
    amountYen,
  }: SyncHospitalVisitExpenseParams,
): Promise<void> {
  const [existing] = await db
    .select()
    .from(expenseRecords)
    .where(eq(expenseRecords.hospitalVisitId, hospitalVisitId))
    .limit(1);
  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
    visitStatement,
  ];

  if (amountYen == null) {
    if (existing != null) {
      // メディアは DB 外にあるため、既存の削除規約に従って先に片付ける。
      await deleteMediaAssetsByRecord(EXPENSE_MEDIA_TYPE, existing.id);
      statements.push(...deleteExpenseStatements(db, existing.id));
    }
    await db.batch(statements);
    return;
  }

  const spentAt = combineDateTimeUtc(splitDateTimeUtc(visitedAt).date, "00:00");

  if (existing != null) {
    statements.push(
      db
        .update(expenseRecords)
        .set({ amountYen, spentAt, updatedAt: new Date() })
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
        hospitalVisitId,
      }),
      db.insert(expenseRecordCats).values({ expenseRecordId: id, catId }),
    );
  }
  await db.batch(statements);
}
