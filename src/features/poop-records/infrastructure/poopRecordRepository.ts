import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { liveRowCondition } from "@/db/conditionalInsert";
import { insertRecordChangeLog } from "@/db/recordChangeLog";
import { poopRecords } from "@/db/schema";
import type { PoopRecordRepository } from "../domain/poopRecordRepository";

/** D1 に保存する `PoopRecordRepository`。`d1` を省略すると Next.js のリクエストの D1 を使う */
export function createPoopRecordRepository(
  d1?: D1Database,
): PoopRecordRepository {
  const db = getDb(d1);
  const byId = (catId: string, id: string) =>
    and(
      eq(poopRecords.id, id),
      eq(poopRecords.catId, catId),
      isNull(poopRecords.deletedAt),
    );
  return {
    async add(catId, content, actor) {
      const id = crypto.randomUUID();
      await db.batch([
        db.insert(poopRecords).values({ id, catId, ...content }),
        insertRecordChangeLog(db, {
          recordType: "poop_record",
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
          .update(poopRecords)
          .set({ ...content, updatedAt: new Date() })
          .where(byId(catId, id))
          .returning({ id: poopRecords.id }),
        insertRecordChangeLog(
          db,
          { recordType: "poop_record", recordId: id, action: "update", actor },
          liveRowCondition(poopRecords, catId, id),
        ),
      ]);
      return updated.length > 0;
    },
    async remove(catId, id, actor) {
      // 削除の後は記録が条件に一致しないため、履歴を先に追加する
      const [, deleted] = await db.batch([
        insertRecordChangeLog(
          db,
          { recordType: "poop_record", recordId: id, action: "delete", actor },
          liveRowCondition(poopRecords, catId, id),
        ),
        db
          .update(poopRecords)
          // 論理削除。削除済みの記録は読み取り・更新から除く
          .set({ deletedAt: new Date() })
          .where(byId(catId, id))
          .returning({ id: poopRecords.id }),
      ]);
      return deleted.length > 0;
    },
  };
}
