import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  householdMembers,
  type MemoLabel,
  memoLabels,
  memoRecordLabels,
  memoRecords,
} from "@/db/schema";
import type { MemoLabelView } from "../domain/memoLabel";

/** 家のメモのラベルの一覧。作った順（ユーザーが家に所属していることは呼び出し元で確認する） */
export async function listMemoLabels(
  householdId: string,
  d1?: D1Database,
): Promise<MemoLabelView[]> {
  return getDb(d1)
    .select({
      id: memoLabels.id,
      name: memoLabels.name,
      color: memoLabels.color,
    })
    .from(memoLabels)
    .where(eq(memoLabels.householdId, householdId))
    .orderBy(asc(memoLabels.createdAt), asc(memoLabels.name));
}

/** メモのラベルと、付いているメモ（削除したものを除く）の数 */
export type MemoLabelWithCount = MemoLabel & { memoCount: number };

/**
 * 複数の家のメモのラベルの一覧に、付いているメモの数を添えて返す。作った順
 * （ユーザーが家に所属していることは呼び出し元で確認する）
 */
export async function listMemoLabelsWithCount(
  householdIds: string[],
  d1?: D1Database,
): Promise<MemoLabelWithCount[]> {
  const db = getDb(d1);
  const rows: MemoLabelWithCount[] = [];
  // 家の ID は D1 のバインド上限に収まるよう分割する
  for (const ids of chunkForBoundParameters(householdIds)) {
    const labels = await db
      .select({ label: memoLabels, memoCount: count(memoRecords.id) })
      .from(memoLabels)
      .leftJoin(
        memoRecordLabels,
        eq(memoRecordLabels.memoLabelId, memoLabels.id),
      )
      .leftJoin(
        memoRecords,
        and(
          eq(memoRecords.id, memoRecordLabels.memoRecordId),
          isNull(memoRecords.deletedAt),
        ),
      )
      .where(inArray(memoLabels.householdId, ids))
      .groupBy(memoLabels.id)
      .orderBy(asc(memoLabels.createdAt), asc(memoLabels.name));
    rows.push(
      ...labels.map(({ label, memoCount }) => ({ ...label, memoCount })),
    );
  }
  return rows;
}

/** ユーザーが所属する家のラベル。存在しない・別の家のラベルなら null */
export async function getMemoLabelForUser(
  userId: string,
  id: string,
  d1?: D1Database,
): Promise<MemoLabel | null> {
  const [row] = await getDb(d1)
    .select({ label: memoLabels })
    .from(memoLabels)
    .innerJoin(
      householdMembers,
      eq(memoLabels.householdId, householdMembers.householdId),
    )
    .where(and(eq(memoLabels.id, id), eq(householdMembers.userId, userId)))
    .limit(1);
  return row?.label ?? null;
}

/** 猫のメモ（削除したものを除く）に付いているラベルの一覧。作った順 */
export async function listMemoLabelsUsedByCat(
  catId: string,
  d1?: D1Database,
): Promise<MemoLabelView[]> {
  const rows = await getDb(d1)
    .selectDistinct({
      id: memoLabels.id,
      name: memoLabels.name,
      color: memoLabels.color,
      // SELECT DISTINCT の並び順に使うため、列に含める
      createdAt: memoLabels.createdAt,
    })
    .from(memoLabels)
    .innerJoin(
      memoRecordLabels,
      eq(memoRecordLabels.memoLabelId, memoLabels.id),
    )
    .innerJoin(memoRecords, eq(memoRecords.id, memoRecordLabels.memoRecordId))
    .where(and(eq(memoRecords.catId, catId), isNull(memoRecords.deletedAt)))
    .orderBy(asc(memoLabels.createdAt), asc(memoLabels.name));
  return rows.map(({ createdAt: _createdAt, ...label }) => label);
}

/**
 * 複数のメモに付いているラベルを、メモの ID ごとに返す。ラベルのないメモは含めない
 * （メモを読めることは呼び出し元で確認する）
 */
export async function listMemoLabelsByRecordIds(
  memoRecordIds: string[],
  d1?: D1Database,
): Promise<Map<string, MemoLabelView[]>> {
  const db = getDb(d1);
  const labelsByRecordId = new Map<string, MemoLabelView[]>();
  for (const ids of chunkForBoundParameters(memoRecordIds)) {
    const rows = await db
      .select({
        memoRecordId: memoRecordLabels.memoRecordId,
        id: memoLabels.id,
        name: memoLabels.name,
        color: memoLabels.color,
      })
      .from(memoRecordLabels)
      .innerJoin(memoLabels, eq(memoLabels.id, memoRecordLabels.memoLabelId))
      .where(inArray(memoRecordLabels.memoRecordId, ids))
      .orderBy(asc(memoLabels.createdAt), asc(memoLabels.name));
    for (const { memoRecordId, ...label } of rows) {
      const list = labelsByRecordId.get(memoRecordId) ?? [];
      list.push(label);
      labelsByRecordId.set(memoRecordId, list);
    }
  }
  return labelsByRecordId;
}
