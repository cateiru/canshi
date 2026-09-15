import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { expenseRecordCats, expenseRecords } from "@/db/schema";
import { deleteMediaAssetsByRecord } from "@/features/media/storage";
import {
  combineDateTimeUtc,
  splitDateTimeUtc,
} from "@/features/shared/datetime";
import { EXPENSE_MEDIA_TYPE } from "./media";
import { getExpenseByHospitalVisitId } from "./queries";

export type SyncHospitalVisitExpenseParams = {
  hospitalVisitId: string;
  catId: string;
  /** 通院記録の受診日時。支出日は同じ日付の 00:00 に揃える */
  visitedAt: Date;
  /** 病院代。null のときは紐付く支出記録を削除する */
  amountYen: number | null;
};

/**
 * 通院記録の病院代を支出記録に反映する。
 * 金額を入力したら作成、変更したら更新、空にしたら削除する。
 * カテゴリ・メモ・関連する猫は支出記録側で自由に変更できるため、
 * 既存の支出記録を更新するときは金額と支出日だけを上書きする
 */
export async function syncHospitalVisitExpense({
  hospitalVisitId,
  catId,
  visitedAt,
  amountYen,
}: SyncHospitalVisitExpenseParams): Promise<void> {
  const db = getDb();
  const existing = await getExpenseByHospitalVisitId(hospitalVisitId);

  if (amountYen == null) {
    if (existing == null) {
      return;
    }
    // 紐付く写真（R2 のオブジェクトと media_assets 行）を先に削除する
    await deleteMediaAssetsByRecord(EXPENSE_MEDIA_TYPE, existing.id);
    await db.batch([
      db
        .delete(expenseRecordCats)
        .where(eq(expenseRecordCats.expenseRecordId, existing.id)),
      db.delete(expenseRecords).where(eq(expenseRecords.id, existing.id)),
    ]);
    return;
  }

  const spentAt = combineDateTimeUtc(splitDateTimeUtc(visitedAt).date, "00:00");

  if (existing != null) {
    await db
      .update(expenseRecords)
      .set({ amountYen, spentAt, updatedAt: new Date() })
      .where(eq(expenseRecords.id, existing.id));
    return;
  }

  const id = crypto.randomUUID();
  await db.batch([
    db.insert(expenseRecords).values({
      id,
      spentAt,
      amountYen,
      // 通院由来の支出は既定で「病院」。支出記録の編集で後から変更できる
      category: "hospital",
      hospitalVisitId,
    }),
    db.insert(expenseRecordCats).values({ expenseRecordId: id, catId }),
  ]);
}
