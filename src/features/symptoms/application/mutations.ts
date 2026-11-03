import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  hospitalVisits,
  medications,
  notifications,
  symptoms,
} from "@/db/schema";
import { deleteMediaAssetsByRecord } from "@/features/media/infrastructure/storage";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import { SYMPTOM_MEDIA_TYPE } from "../domain/media";
import type { SymptomFormInput } from "../domain/schema";

/*
 * 症状の記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

export const SYMPTOM_HOSPITAL_VISIT_NOT_FOUND_ERROR =
  "関連する通院記録が見つかりませんでした";

export const SYMPTOM_NOT_FOUND_ERROR = "記録が見つかりませんでした";

export type SaveSymptomResult = { id: string } | { error: string };

async function verifyHospitalVisitBelongsToCat(
  db: ReturnType<typeof getDb>,
  hospitalVisitId: string | undefined,
  catId: string,
): Promise<boolean> {
  if (hospitalVisitId == null) {
    return true;
  }
  const [row] = await db
    .select({ id: hospitalVisits.id })
    .from(hospitalVisits)
    .where(
      and(
        eq(hospitalVisits.id, hospitalVisitId),
        eq(hospitalVisits.catId, catId),
      ),
    )
    .limit(1);
  return row != null;
}

function toValues(data: SymptomFormInput) {
  return {
    symptomType: data.symptomType,
    onsetAt: combineDateTimeUtc(data.onsetDate, data.onsetTime),
    frequencyOrSeverity: data.frequencyOrSeverity ?? null,
    appetiteNote: data.appetiteNote ?? null,
    energyNote: data.energyNote ?? null,
    status: data.status,
    hospitalVisitId: data.hospitalVisitId ?? null,
    memo: data.memo ?? null,
  };
}

/** 記録を追加する。関連する通院記録は同じ猫のものに限る */
export async function createSymptom(
  catId: string,
  data: SymptomFormInput,
  d1?: D1Database,
): Promise<SaveSymptomResult> {
  const db = getDb(d1);
  if (
    !(await verifyHospitalVisitBelongsToCat(db, data.hospitalVisitId, catId))
  ) {
    return { error: SYMPTOM_HOSPITAL_VISIT_NOT_FOUND_ERROR };
  }
  const [created] = await db
    .insert(symptoms)
    .values({ catId, ...toValues(data) })
    .returning({ id: symptoms.id });
  return { id: created.id };
}

/** 猫の記録を更新する。関連する通院記録は同じ猫のものに限る */
export async function updateSymptom(
  catId: string,
  id: string,
  data: SymptomFormInput,
  d1?: D1Database,
): Promise<SaveSymptomResult> {
  const db = getDb(d1);
  if (
    !(await verifyHospitalVisitBelongsToCat(db, data.hospitalVisitId, catId))
  ) {
    return { error: SYMPTOM_HOSPITAL_VISIT_NOT_FOUND_ERROR };
  }

  const result = await db
    .update(symptoms)
    .set({ ...toValues(data), updatedAt: new Date() })
    .where(and(eq(symptoms.id, id), eq(symptoms.catId, catId)))
    .returning({ id: symptoms.id });
  if (result.length === 0) {
    return { error: SYMPTOM_NOT_FOUND_ERROR };
  }

  // 解消にした症状について、未対応のまま残っている確認通知（`symptom_ongoing`）は
  // もう答える必要がないため完了にする
  if (data.status === "resolved") {
    await db
      .update(notifications)
      .set({ status: "done", updatedAt: new Date() })
      .where(
        and(
          eq(notifications.kind, "symptom_ongoing"),
          eq(notifications.referenceId, id),
          eq(notifications.catId, catId),
          inArray(notifications.status, ["pending", "snoozed"]),
        ),
      );
  }
  return { id };
}

/**
 * 猫の症状の記録を、紐付く写真・動画（R2 のオブジェクトと media_assets 行）と確認通知ごと削除する。
 * 投薬・通院記録からの紐付けは外し、それらの記録は残す。見つからなければ false
 */
export async function deleteSymptom(
  catId: string,
  id: string,
): Promise<boolean> {
  const db = getDb();
  // 添付の削除は記録 ID だけで行うため、先に記録がこの猫のものであることを確かめる。
  // 確かめないと、自分の猫の catId と別の家の記録 ID を渡して添付を消せてしまう
  const [existing] = await db
    .select({ id: symptoms.id })
    .from(symptoms)
    .where(and(eq(symptoms.id, id), eq(symptoms.catId, catId)))
    .limit(1);
  if (!existing) return false;
  // 紐付く写真・動画（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(SYMPTOM_MEDIA_TYPE, id);
  // medications.symptom_id / hospital_visits.symptom_id からの外部キー参照が
  // あるため、症状を削除する前に参照している側の紐付けを外しておく。
  // notifications の reference_id もこの症状を指しうる（`symptom_ongoing`）ため、
  // 確認通知もあわせて削除する。操作の間に別リクエストが割り込まないよう
  // db.batch でまとめて原子的に実行する
  await db.batch([
    db
      .update(medications)
      .set({ symptomId: null, updatedAt: new Date() })
      .where(and(eq(medications.symptomId, id), eq(medications.catId, catId))),
    db
      .update(hospitalVisits)
      .set({ symptomId: null })
      .where(
        and(eq(hospitalVisits.symptomId, id), eq(hospitalVisits.catId, catId)),
      ),
    db
      .delete(notifications)
      .where(
        and(
          eq(notifications.kind, "symptom_ongoing"),
          eq(notifications.referenceId, id),
          eq(notifications.catId, catId),
        ),
      ),
    db
      .delete(symptoms)
      .where(and(eq(symptoms.id, id), eq(symptoms.catId, catId))),
  ]);
  return true;
}
