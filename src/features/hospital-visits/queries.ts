import { and, asc, desc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  cats,
  expenseRecordHospitalVisits,
  type HospitalVisit,
  hospitalVisits,
} from "@/db/schema";
import { accessibleCatIdsQuery } from "@/features/households/queries";
import { combineDateTimeUtc } from "@/features/shared/datetime";

export async function listHospitalVisits(catId: string) {
  const db = getDb();
  return db
    .select()
    .from(hospitalVisits)
    .where(eq(hospitalVisits.catId, catId))
    .orderBy(desc(hospitalVisits.visitedAt));
}

export async function getHospitalVisitById(id: string) {
  const db = getDb();
  const [hospitalVisit] = await db
    .select()
    .from(hospitalVisits)
    .where(eq(hospitalVisits.id, id))
    .limit(1);
  return hospitalVisit ?? null;
}

/**
 * 通院記録 ID の一覧から、まとめて通院記録を取得する。
 * 他の記録一覧で関連する通院記録を表示するときに N+1 クエリにならないようにするためのもの。
 * 支出記録は家を問わず共通のため、紐付いた通院記録のうちユーザーの家の猫のものだけを返す
 */
export async function listHospitalVisitsByIds(
  userId: string,
  ids: string[],
): Promise<Map<string, HospitalVisit>> {
  const byId = new Map<string, HospitalVisit>();
  if (ids.length === 0) {
    return byId;
  }
  const db = getDb();
  // `accessibleCatIdsQuery` の userId の分を 1 個予約する
  for (const chunk of chunkForBoundParameters(ids, 1)) {
    const rows = await db
      .select()
      .from(hospitalVisits)
      .where(
        and(
          inArray(hospitalVisits.id, chunk),
          inArray(hospitalVisits.catId, accessibleCatIdsQuery(db, userId)),
        ),
      );
    for (const row of rows) {
      byId.set(row.id, row);
    }
  }
  return byId;
}

/** 支出記録（病院代）に紐付ける候補として表示する通院記録 */
export type LinkableHospitalVisit = Pick<
  HospitalVisit,
  "id" | "catId" | "visitedAt" | "reason"
> & {
  catName: string;
  /** すでに病院代として紐付いている支出記録の ID。未紐付けなら null */
  expenseRecordId: string | null;
};

/**
 * 指定した日（`YYYY-MM-DD`）の、ユーザーの家のすべての猫の通院記録を、受診日時の順に返す。
 * 支出記録で「病院」を選んだときに、同じ日の通院記録を紐付ける候補にする。
 * `expenseRecordId` を渡すと、その支出記録にすでに紐付いている通院記録も含める
 * （共有している病院代は受診日を変えても支出日を変えないため、日付がずれていることがある）
 */
export async function listHospitalVisitsOnDate(
  userId: string,
  date: string,
  expenseRecordId?: string,
): Promise<LinkableHospitalVisit[]> {
  const db = getDb();
  const start = combineDateTimeUtc(date, "00:00");
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return db
    .select({
      id: hospitalVisits.id,
      catId: hospitalVisits.catId,
      visitedAt: hospitalVisits.visitedAt,
      reason: hospitalVisits.reason,
      catName: cats.name,
      expenseRecordId: expenseRecordHospitalVisits.expenseRecordId,
    })
    .from(hospitalVisits)
    .innerJoin(cats, eq(hospitalVisits.catId, cats.id))
    .leftJoin(
      expenseRecordHospitalVisits,
      eq(expenseRecordHospitalVisits.hospitalVisitId, hospitalVisits.id),
    )
    .where(
      and(
        // 支出記録は家を問わず共通のため、共有の支出記録の ID を指定されても
        // 別の家の猫の通院記録は返さない
        inArray(hospitalVisits.catId, accessibleCatIdsQuery(db, userId)),
        or(
          and(
            gte(hospitalVisits.visitedAt, start),
            lt(hospitalVisits.visitedAt, end),
          ),
          expenseRecordId == null
            ? undefined
            : eq(expenseRecordHospitalVisits.expenseRecordId, expenseRecordId),
        ),
      ),
    )
    .orderBy(
      asc(hospitalVisits.visitedAt),
      asc(cats.createdAt),
      asc(hospitalVisits.id),
    );
}
