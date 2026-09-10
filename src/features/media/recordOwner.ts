import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  catPhotos,
  foodProducts,
  hospitalVisits,
  medications,
  poopRecords,
  symptoms,
  vomitRecords,
} from "@/db/schema";
import type { MediaRecordType } from "./recordTypes";

export type MediaRecordOwner = {
  /** 猫に紐付かないレコード（ごはん商品）は null */
  catId: string | null;
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
        .where(eq(poopRecords.id, recordId))
        .limit(1);
      return row ?? null;
    }
    case "vomit_record": {
      const [row] = await db
        .select({ catId: vomitRecords.catId })
        .from(vomitRecords)
        .where(eq(vomitRecords.id, recordId))
        .limit(1);
      return row ?? null;
    }
    case "symptom": {
      const [row] = await db
        .select({ catId: symptoms.catId })
        .from(symptoms)
        .where(eq(symptoms.id, recordId))
        .limit(1);
      return row ?? null;
    }
    case "medication": {
      const [row] = await db
        .select({ catId: medications.catId })
        .from(medications)
        .where(eq(medications.id, recordId))
        .limit(1);
      return row ?? null;
    }
    case "hospital_visit": {
      const [row] = await db
        .select({ catId: hospitalVisits.catId })
        .from(hospitalVisits)
        .where(eq(hospitalVisits.id, recordId))
        .limit(1);
      return row ?? null;
    }
    case "cat_photo": {
      const [row] = await db
        .select({ catId: catPhotos.catId })
        .from(catPhotos)
        .where(eq(catPhotos.id, recordId))
        .limit(1);
      return row ?? null;
    }
    case "food_product": {
      const [row] = await db
        .select({ id: foodProducts.id })
        .from(foodProducts)
        .where(eq(foodProducts.id, recordId))
        .limit(1);
      return row ? { catId: null } : null;
    }
    default: {
      const exhaustiveCheck: never = recordType;
      return exhaustiveCheck;
    }
  }
}
