import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { hospitalVisits, notifications, symptoms } from "@/db/schema";
import { combineDateTimeUtc } from "@/features/shared/datetime";
import type { SymptomFormInput } from "./schema";

/*
 * 症状の記録の保存。画面（`./actions.ts`）と AI との接続（MCP）の両方から使う。
 * 猫を参照できるかは呼び出し側で確かめる。MCP は Durable Object の中で動き
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
