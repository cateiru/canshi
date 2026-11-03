import { createHospitalVisitRepository } from "@/features/hospital-visits/infrastructure/hospitalVisitRepository";
import { deleteMediaAssetsByRecord } from "@/features/media/infrastructure/storage";
import { createNotificationRepository } from "@/features/notifications/infrastructure/notificationRepository";
import { SYMPTOM_MEDIA_TYPE } from "../domain/media";
import type { SymptomFormInput } from "../domain/schema";
import { toSymptomContent } from "../domain/symptom";
import { createSymptomRepository } from "../infrastructure/symptomRepository";

/*
 * 症状の記録の保存（ユースケース）。画面（`../presentation/actions.ts`）と AI との接続（MCP）の
 * 両方から使う。猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

export const SYMPTOM_HOSPITAL_VISIT_NOT_FOUND_ERROR =
  "関連する通院記録が見つかりませんでした";

export const SYMPTOM_NOT_FOUND_ERROR = "記録が見つかりませんでした";

export type SaveSymptomResult = { id: string } | { error: string };

async function verifyHospitalVisitBelongsToCat(
  hospitalVisitId: string | undefined,
  catId: string,
  d1?: D1Database,
): Promise<boolean> {
  if (hospitalVisitId == null) {
    return true;
  }
  return createHospitalVisitRepository(d1).existsForCat(catId, hospitalVisitId);
}

/** 記録を追加する。関連する通院記録は同じ猫のものに限る */
export async function createSymptom(
  catId: string,
  data: SymptomFormInput,
  d1?: D1Database,
): Promise<SaveSymptomResult> {
  if (
    !(await verifyHospitalVisitBelongsToCat(data.hospitalVisitId, catId, d1))
  ) {
    return { error: SYMPTOM_HOSPITAL_VISIT_NOT_FOUND_ERROR };
  }
  const id = await createSymptomRepository(d1).add(
    catId,
    toSymptomContent(data),
  );
  return { id };
}

/** 猫の記録を更新する。関連する通院記録は同じ猫のものに限る */
export async function updateSymptom(
  catId: string,
  id: string,
  data: SymptomFormInput,
  d1?: D1Database,
): Promise<SaveSymptomResult> {
  if (
    !(await verifyHospitalVisitBelongsToCat(data.hospitalVisitId, catId, d1))
  ) {
    return { error: SYMPTOM_HOSPITAL_VISIT_NOT_FOUND_ERROR };
  }

  if (
    !(await createSymptomRepository(d1).update(
      catId,
      id,
      toSymptomContent(data),
    ))
  ) {
    return { error: SYMPTOM_NOT_FOUND_ERROR };
  }

  // 解消にした症状について、未対応のまま残っている確認通知（`symptom_ongoing`）は
  // もう答える必要がないため完了にする
  if (data.status === "resolved") {
    await createNotificationRepository(d1).completeOngoingSymptomNotifications(
      catId,
      id,
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
  const repository = createSymptomRepository();
  // 添付の削除は記録 ID だけで行うため、先に記録がこの猫のものであることを確かめる。
  // 確かめないと、自分の猫の catId と別の家の記録 ID を渡して添付を消せてしまう
  if (!(await repository.existsForCat(catId, id))) return false;
  // 紐付く写真・動画（R2 のオブジェクトと media_assets 行）を先に削除する
  await deleteMediaAssetsByRecord(SYMPTOM_MEDIA_TYPE, id);
  await repository.remove(catId, id);
  return true;
}
