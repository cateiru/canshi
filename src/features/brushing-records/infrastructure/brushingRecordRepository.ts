import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  insertWhere,
  writableCatCondition,
  writableRowCondition,
} from "@/db/conditionalInsert";
import { insertRecordChangeLog } from "@/db/recordChangeLog";
import { brushingRecords } from "@/db/schema";
import type { BrushingRecordRepository } from "../domain/brushingRecordRepository";

/** D1 に保存する `BrushingRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createBrushingRecordRepository(
  d1?: D1Database,
): BrushingRecordRepository {
  const db = getDb(d1);
  const byId = (catId: string, id: string) =>
    and(
      eq(brushingRecords.id, id),
      eq(brushingRecords.catId, catId),
      isNull(brushingRecords.deletedAt),
      // メモリーへ移した猫の記録は書き換えない
      writableCatCondition(catId),
    );
  return {
    async add(catId, content, actor) {
      const id = crypto.randomUUID();
      // メモリーへ移した猫には記録を追加しない
      const [created] = await db.batch([
        insertWhere(
          db,
          brushingRecords,
          { id, catId, ...content },
          writableCatCondition(catId),
        ).returning({ id: brushingRecords.id }),
        // 挿入が断られたときは履歴も追加しない
        insertRecordChangeLog(
          db,
          {
            recordType: "brushing_record",
            recordId: id,
            action: "create",
            actor,
          },
          writableRowCondition(brushingRecords, catId, id),
        ),
      ]);
      return created.length > 0 ? id : null;
    },
    async update(catId, id, content, actor) {
      const [updated] = await db.batch([
        db
          .update(brushingRecords)
          .set({ ...content, updatedAt: new Date() })
          .where(byId(catId, id))
          .returning({ id: brushingRecords.id }),
        insertRecordChangeLog(
          db,
          {
            recordType: "brushing_record",
            recordId: id,
            action: "update",
            actor,
          },
          writableRowCondition(brushingRecords, catId, id),
        ),
      ]);
      return updated.length > 0;
    },
    async remove(catId, id, actor) {
      // 削除の後は記録が条件に一致しないため、履歴を先に追加する
      const [, deleted] = await db.batch([
        insertRecordChangeLog(
          db,
          {
            recordType: "brushing_record",
            recordId: id,
            action: "delete",
            actor,
          },
          writableRowCondition(brushingRecords, catId, id),
        ),
        db
          .update(brushingRecords)
          // 論理削除。削除済みの記録は読み取り・更新から除く
          .set({ deletedAt: new Date() })
          .where(byId(catId, id))
          .returning({ id: brushingRecords.id }),
      ]);
      return deleted.length > 0;
    },
  };
}
