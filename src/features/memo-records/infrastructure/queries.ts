import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { type MemoRecord, memoRecords } from "@/db/schema";

/**
 * 猫のメモを、日付を残さないメモ（新しく作った順）、日付を残したメモ（新しい日付順）の
 * 順に返す。日付は日本時間の時計の数字をそのまま UTC として保存し、作成日時は実際の
 * UTC のため、両者を混ぜて並べると 9 時間ずれる。そのため日付の有無でまとめて並べる
 */
export async function listMemoRecords(catId: string, d1?: D1Database) {
  return getDb(d1)
    .select()
    .from(memoRecords)
    .where(and(eq(memoRecords.catId, catId), isNull(memoRecords.deletedAt)))
    .orderBy(
      sql`${memoRecords.recordedAt} is not null`,
      desc(memoRecords.recordedAt),
      desc(memoRecords.createdAt),
    );
}

export async function getMemoRecordById(id: string) {
  const db = getDb();
  const [record] = await db
    .select()
    .from(memoRecords)
    .where(and(eq(memoRecords.id, id), isNull(memoRecords.deletedAt)))
    .limit(1);
  return record ?? null;
}

/** 猫のメモの記録を ID で 1 件読む。別の猫の記録・見つからなければ null */
export async function getMemoRecordForCat(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<MemoRecord | null> {
  const [record] = await getDb(d1)
    .select()
    .from(memoRecords)
    .where(
      and(
        eq(memoRecords.id, id),
        eq(memoRecords.catId, catId),
        isNull(memoRecords.deletedAt),
      ),
    )
    .limit(1);
  return record ?? null;
}
