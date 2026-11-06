import { and, eq, inArray, type SQL, type SQLWrapper } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { getDb } from "./client";
import { insertWhere } from "./conditionalInsert";
import {
  type RecordActor,
  type RecordChangeLogAction,
  type RecordChangeLogRecordType,
  recordChangeLogs,
} from "./schema/record-change-logs";

type Db = ReturnType<typeof getDb>;

/**
 * 記録の作成・編集・削除の履歴を 1 行追加する文。記録を書き込む文と同じ batch に並べ、
 * 書き込みと履歴の片方だけが残らないようにする。
 *
 * `condition` には、記録を書き込む文と同じ条件を渡す。書き込みが条件で断られたときに、
 * 履歴だけが残らないようにするため。文を並べる順番は次のとおり。
 * - 追加：記録を挿入する文の後（挿入された行を条件で見る）
 * - 編集：記録を更新する文の後。更新で偽になる条件（「未解消なら」など）を含むときは前
 * - 論理削除：記録を更新する文の前（更新の後は `deleted_at IS NULL` が偽になるため）
 */
export function insertRecordChangeLog(
  db: Db,
  change: {
    recordType: RecordChangeLogRecordType;
    recordId: string;
    action: RecordChangeLogAction;
    actor: RecordActor;
  },
  condition?: SQLWrapper,
) {
  return insertWhere(
    db,
    recordChangeLogs,
    {
      recordType: change.recordType,
      recordId: change.recordId,
      action: change.action,
      userId: change.actor.userId,
      mcpClientId: change.actor.mcpClientId,
    },
    condition,
  );
}

/**
 * 物理削除する記録の履歴を消す文。記録を消す文より前に並べる。
 * `where` には、物理削除する記録を選ぶ条件を渡す
 */
export function deleteRecordChangeLogsOf(
  db: Db,
  recordType: RecordChangeLogRecordType,
  table: SQLiteTable & { id: SQLiteColumn },
  where: SQL | undefined,
) {
  return db
    .delete(recordChangeLogs)
    .where(
      and(
        eq(recordChangeLogs.recordType, recordType),
        inArray(
          recordChangeLogs.recordId,
          db.select({ id: table.id }).from(table).where(where),
        ),
      ),
    );
}
