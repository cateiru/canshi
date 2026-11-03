import type { CleaningTargetContent } from "../domain/cleaningTarget";
import type { CleaningTargetFormInput } from "../domain/targetSchema";
import { createCleaningTargetRepository } from "../infrastructure/cleaningTargetRepository";

/*
 * 掃除対象の保存（ユースケース）。猫を参照できるかは呼び出し側で確かめる。
 * ほかの記録の mutations と揃えて、D1 は引数でも受け取れるようにする
 */

/** 掃除対象を一覧の末尾に追加する */
export async function createCleaningTarget(
  catId: string,
  data: Omit<CleaningTargetContent, "notifyTime"> &
    Partial<Pick<CleaningTargetContent, "notifyTime">>,
  d1?: D1Database,
): Promise<void> {
  await createCleaningTargetRepository(d1).add(catId, {
    name: data.name,
    frequencyValue: data.frequencyValue,
    frequencyUnit: data.frequencyUnit,
    isActive: data.isActive,
    notifyTime: data.notifyTime ?? null,
  });
}

/** 猫の掃除対象を更新する。見つからなければ false */
export async function updateCleaningTarget(
  catId: string,
  id: string,
  data: CleaningTargetFormInput,
  d1?: D1Database,
): Promise<boolean> {
  return createCleaningTargetRepository(d1).update(catId, id, {
    name: data.name,
    frequencyValue: data.frequencyValue,
    frequencyUnit: data.frequencyUnit,
    isActive: data.isActive,
    notifyTime: data.notifyTime ?? null,
  });
}

/** 猫の掃除対象を、実施記録・通知・通知設定ごと削除する */
export async function deleteCleaningTarget(
  catId: string,
  id: string,
  d1?: D1Database,
): Promise<void> {
  await createCleaningTargetRepository(d1).remove(catId, id);
}
