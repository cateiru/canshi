import { and, eq, isNull, type SQL, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { getDb } from "@/db/client";
import {
  expenseRecordCats,
  expenseRecordHospitalVisits,
  expenseRecords,
} from "@/db/schema";
import {
  combineDateTimeUtc,
  splitDateTimeUtc,
} from "@/features/shared/datetime";
import {
  deleteExpenseStatements,
  liveExpenseCondition,
  liveHospitalVisitCondition,
} from "./storage";

/** batch の先頭の通院記録の文（`.returning()` 付き）で、通院記録が保存されたか */
function visitWasSaved(results: unknown[]): boolean {
  const [visitResult] = results;
  return Array.isArray(visitResult) && visitResult.length > 0;
}

/** `timestamp` 列に INSERT ... SELECT で入れる値（UNIX 秒） */
function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

export type SyncHospitalVisitExpenseParams = {
  hospitalVisitId: string;
  catId: string;
  /** 通院した猫の家。病院代の支出記録を新しく作るときは、この家の支出にする */
  householdId: string;
  /** 通院記録の受診日時。支出日は同じ日付の 00:00 に揃える */
  visitedAt: Date;
  /** 病院代。null のときは紐付く支出記録を論理削除する（他の通院記録と共有していれば紐付けだけ外す） */
  amountYen: number | null;
  /**
   * 病院代を入力せずに、既存の支出記録（同じ日の「病院」）へ紐付けるときの支出記録 ID。
   * 存在・カテゴリ・日付の確認は呼び出し元で行う。病院代を入力した場合は使わない
   */
  linkExpenseRecordId?: string | null;
  /**
   * 病院代が空欄でも、この支出記録に紐付いていれば紐付けをそのまま維持する。既存の支出記録へ
   * 紐付けて作成した後の再送信（添付の保存の再試行など）で、紐付けた支出記録を削除しないために使う。
   * 現在の紐付けと一致しないときは使わない
   */
  keepLinkedExpenseRecordId?: string | null;
};

/**
 * 通院記録と病院代を同じ batch で保存し、片方だけが保存されることを防ぐ。
 * `visitStatement` は `.returning()` を付けた通院記録の INSERT・UPDATE で、通院記録が保存されたか
 * （保存されなかった場合は、病院代の文も通院記録が見つからず何もしない）を返す。
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
    householdId,
    visitedAt,
    amountYen,
    linkExpenseRecordId,
    keepLinkedExpenseRecordId,
  }: SyncHospitalVisitExpenseParams,
  visitCondition?: SQL,
): Promise<boolean> {
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
  // 病院代の文は、通院記録が削除されずにあるときだけ実行する。確認の後に通院記録が論理削除された場合に、
  // 通院記録の更新は通らないのに支出だけが追加・変更されることを防ぐ
  // （通院記録の追加では、同じ batch の先頭で挿入した通院記録を見る）
  // `visitCondition` には、通院記録の文が保存の条件にしたもの（関連する症状が削除されていないことなど）
  // を渡す。通院記録の文が条件で断られたときに、病院代の文だけが通らないようにする
  const visitIsLive = sql`${liveHospitalVisitCondition(hospitalVisitId)}${
    visitCondition == null ? sql`` : sql` AND ${visitCondition}`
  }`;

  if (amountYen == null) {
    if (existing != null && existing.id === keepLinkedExpenseRecordId) {
      // 病院代を空欄のまま既存の支出記録に紐付けているだけなので、支出記録には触れない
    } else if (existing != null && isShared) {
      statements.push(
        db
          .delete(expenseRecordHospitalVisits)
          .where(
            and(
              eq(expenseRecordHospitalVisits.expenseRecordId, existing.id),
              eq(expenseRecordHospitalVisits.hospitalVisitId, hospitalVisitId),
              visitIsLive,
            ),
          ),
      );
    } else if (existing != null) {
      // 支出記録を論理削除する。添付の写真は残す
      statements.push(...deleteExpenseStatements(db, existing.id, visitIsLive));
    } else if (linkExpenseRecordId != null) {
      // 紐付ける支出が確認の後に論理削除された場合も、紐付けない
      const bothAreLive = sql`${visitIsLive} AND ${liveExpenseCondition(linkExpenseRecordId)}`;
      statements.push(
        db
          .insert(expenseRecordHospitalVisits)
          .select(
            sql`SELECT ${linkExpenseRecordId}, ${hospitalVisitId} WHERE ${bothAreLive}`,
          ),
        // 支出記録の「{猫名}のみ」の絞り込みやタイムラインに出るよう、通院した猫も関連付ける
        db
          .insert(expenseRecordCats)
          .select(
            sql`SELECT ${linkExpenseRecordId}, ${catId} WHERE ${bothAreLive}`,
          )
          .onConflictDoNothing(),
      );
    }
    return visitWasSaved(await db.batch(statements));
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
        .where(
          and(
            eq(expenseRecords.id, existing.id),
            isNull(expenseRecords.deletedAt),
            visitIsLive,
          ),
        ),
    );
  } else {
    const id = crypto.randomUUID();
    // INSERT ... SELECT では列の既定値が使われないため、列はテーブル定義と同じ並びにすべて書く。
    // 支出が挿入されなかった場合は、紐付けも支出が見つからないため挿入されない
    const bothAreLive = sql`${visitIsLive} AND ${liveExpenseCondition(id)}`;
    statements.push(
      db.insert(expenseRecords).select(
        // 通院由来の支出は既定で「病院」。支出記録の編集で後から変更できる
        sql`SELECT ${id}, ${householdId}, ${toUnixSeconds(spentAt)}, ${amountYen}, 'hospital',
            NULL, unixepoch(), unixepoch(), NULL
            WHERE ${visitIsLive}`,
      ),
      db
        .insert(expenseRecordHospitalVisits)
        .select(sql`SELECT ${id}, ${hospitalVisitId} WHERE ${bothAreLive}`),
      db
        .insert(expenseRecordCats)
        .select(sql`SELECT ${id}, ${catId} WHERE ${bothAreLive}`),
    );
  }
  return visitWasSaved(await db.batch(statements));
}
