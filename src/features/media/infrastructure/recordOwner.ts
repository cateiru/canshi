import { and, eq, isNull, type SQL, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  cats,
  expenseRecords,
  foodProducts,
  hospitalVisits,
  medications,
  memoRecords,
  poopRecords,
  symptoms,
  vomitRecords,
} from "@/db/schema";
import { isMediaRecordType, type MediaRecordType } from "../domain/recordTypes";

export type MediaRecordOwner = {
  /** 猫に紐付かないレコード（ごはん商品・支出）は null */
  catId: string | null;
  /**
   * 猫に紐付かず家に属するレコード（支出・ごはん商品）の家。家に未所属なら null。
   * 家に属さないレコードでは省略する
   */
  householdId?: string | null;
};

/**
 * 添付先レコードが実在するかを確認し、紐付ける猫 ID を返す。
 * 存在しない場合は null。アップロード API が、任意の recordId を指定して
 * 孤立したメディアを作られないようにするためのガード
 */
export async function resolveMediaRecordOwner(
  recordType: MediaRecordType,
  recordId: string,
): Promise<MediaRecordOwner | null> {
  const db = getDb();
  switch (recordType) {
    case "poop_record": {
      const [row] = await db
        .select({ catId: poopRecords.catId })
        .from(poopRecords)
        .where(and(eq(poopRecords.id, recordId), isNull(poopRecords.deletedAt)))
        .limit(1);
      return row ?? null;
    }
    case "vomit_record": {
      const [row] = await db
        .select({ catId: vomitRecords.catId })
        .from(vomitRecords)
        .where(
          and(eq(vomitRecords.id, recordId), isNull(vomitRecords.deletedAt)),
        )
        .limit(1);
      return row ?? null;
    }
    case "symptom": {
      const [row] = await db
        .select({ catId: symptoms.catId })
        .from(symptoms)
        .where(and(eq(symptoms.id, recordId), isNull(symptoms.deletedAt)))
        .limit(1);
      return row ?? null;
    }
    case "medication": {
      const [row] = await db
        .select({ catId: medications.catId })
        .from(medications)
        .where(and(eq(medications.id, recordId), isNull(medications.deletedAt)))
        .limit(1);
      return row ?? null;
    }
    case "hospital_visit": {
      const [row] = await db
        .select({ catId: hospitalVisits.catId })
        .from(hospitalVisits)
        .where(
          and(
            eq(hospitalVisits.id, recordId),
            isNull(hospitalVisits.deletedAt),
          ),
        )
        .limit(1);
      return row ?? null;
    }
    case "memo_record": {
      const [row] = await db
        .select({ catId: memoRecords.catId })
        .from(memoRecords)
        .where(and(eq(memoRecords.id, recordId), isNull(memoRecords.deletedAt)))
        .limit(1);
      return row ?? null;
    }
    case "cat_profile": {
      // プロフィール画像は猫そのものに紐付くため、recordId は猫の ID
      const [row] = await db
        .select({ catId: cats.id })
        .from(cats)
        .where(eq(cats.id, recordId))
        .limit(1);
      return row ?? null;
    }
    case "expense": {
      // 支出は家の猫で共通のため、特定の猫には紐付けず家で判定する
      const [row] = await db
        .select({ householdId: expenseRecords.householdId })
        .from(expenseRecords)
        .where(
          and(
            eq(expenseRecords.id, recordId),
            isNull(expenseRecords.deletedAt),
          ),
        )
        .limit(1);
      return row ? { catId: null, householdId: row.householdId } : null;
    }
    case "food_product": {
      // ごはん商品は家の猫で共通のため、特定の猫には紐付けず家で判定する
      const [row] = await db
        .select({ householdId: foodProducts.householdId })
        .from(foodProducts)
        .where(eq(foodProducts.id, recordId))
        .limit(1);
      return row ? { catId: null, householdId: row.householdId } : null;
    }
    default: {
      const exhaustiveCheck: never = recordType;
      return exhaustiveCheck;
    }
  }
}

/**
 * 添付先レコードが実在し、論理削除されていないときだけ真になる条件。
 * `media_assets` を記録に紐付ける文（作成・付け替え）の WHERE に含め、`resolveMediaRecordOwner` での
 * 確認の後に記録が論理削除された場合に、削除済みの記録へ新しく添付されないようにする
 * （`media_assets.record_id` は種別との組で参照するため外部キーがなく、制約では防げない）。
 * 論理削除しないレコード（猫のプロフィール・ごはん商品）は実在だけを確かめる。
 * 記録の種別でないもの（下書き・開発用・共通のごはん商品・ユーザーのアイコン）には条件を付けない
 */
export function liveMediaRecordCondition(
  recordType: string,
  recordId: string,
): SQL | undefined {
  if (!isMediaRecordType(recordType)) {
    return undefined;
  }
  switch (recordType) {
    case "poop_record":
      return sql`EXISTS (SELECT 1 FROM ${poopRecords} WHERE ${poopRecords.id} = ${recordId} AND ${poopRecords.deletedAt} IS NULL)`;
    case "vomit_record":
      return sql`EXISTS (SELECT 1 FROM ${vomitRecords} WHERE ${vomitRecords.id} = ${recordId} AND ${vomitRecords.deletedAt} IS NULL)`;
    case "symptom":
      return sql`EXISTS (SELECT 1 FROM ${symptoms} WHERE ${symptoms.id} = ${recordId} AND ${symptoms.deletedAt} IS NULL)`;
    case "medication":
      return sql`EXISTS (SELECT 1 FROM ${medications} WHERE ${medications.id} = ${recordId} AND ${medications.deletedAt} IS NULL)`;
    case "hospital_visit":
      return sql`EXISTS (SELECT 1 FROM ${hospitalVisits} WHERE ${hospitalVisits.id} = ${recordId} AND ${hospitalVisits.deletedAt} IS NULL)`;
    case "memo_record":
      return sql`EXISTS (SELECT 1 FROM ${memoRecords} WHERE ${memoRecords.id} = ${recordId} AND ${memoRecords.deletedAt} IS NULL)`;
    case "expense":
      return sql`EXISTS (SELECT 1 FROM ${expenseRecords} WHERE ${expenseRecords.id} = ${recordId} AND ${expenseRecords.deletedAt} IS NULL)`;
    case "cat_profile":
      return sql`EXISTS (SELECT 1 FROM ${cats} WHERE ${cats.id} = ${recordId})`;
    case "food_product":
      return sql`EXISTS (SELECT 1 FROM ${foodProducts} WHERE ${foodProducts.id} = ${recordId})`;
    default: {
      const exhaustiveCheck: never = recordType;
      return exhaustiveCheck;
    }
  }
}
