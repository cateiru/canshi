import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { liveRowCondition } from "@/db/conditionalInsert";
import { insertRecordChangeLog } from "@/db/recordChangeLog";
import { waterRecords } from "@/db/schema";
import type { WaterRecordRepository } from "../domain/waterRecordRepository";

/** D1 に保存する `WaterRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createWaterRecordRepository(
  d1?: D1Database,
): WaterRecordRepository {
  const db = getDb(d1);
  const byId = (catId: string, id: string) =>
    and(
      eq(waterRecords.id, id),
      eq(waterRecords.catId, catId),
      isNull(waterRecords.deletedAt),
    );
  return {
    async add(catId, content, actor) {
      const id = crypto.randomUUID();
      await db.batch([
        db.insert(waterRecords).values({ id, catId, ...content }),
        insertRecordChangeLog(db, {
          recordType: "water_record",
          recordId: id,
          action: "create",
          actor,
        }),
      ]);
      return id;
    },
    async update(catId, id, content, actor) {
      const [updated] = await db.batch([
        db
          .update(waterRecords)
          .set({ ...content, updatedAt: new Date() })
          .where(byId(catId, id))
          .returning({ id: waterRecords.id }),
        insertRecordChangeLog(
          db,
          { recordType: "water_record", recordId: id, action: "update", actor },
          liveRowCondition(waterRecords, catId, id),
        ),
      ]);
      return updated.length > 0;
    },
    async remove(catId, id, actor) {
      // 削除の後は記録が条件に一致しないため、履歴を先に追加する
      const [, deleted] = await db.batch([
        insertRecordChangeLog(
          db,
          { recordType: "water_record", recordId: id, action: "delete", actor },
          liveRowCondition(waterRecords, catId, id),
        ),
        db
          .update(waterRecords)
          // 論理削除。削除済みの記録は読み取り・更新から除く
          .set({ deletedAt: new Date() })
          .where(byId(catId, id))
          .returning({ id: waterRecords.id }),
      ]);
      return deleted.length > 0;
    },
  };
}
