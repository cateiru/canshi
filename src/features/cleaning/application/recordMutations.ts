import type { RecordActor } from "@/db/schema";
import { getNaiveUtcNow } from "@/features/shared/datetime";
import {
  type CleaningRecordContent,
  cleaningNotificationsDueBefore,
  toCleaningRecordContent,
} from "../domain/cleaningRecord";
import type { CleaningRecordFormInput } from "../domain/recordSchema";
import { createCleaningRecordRepository } from "../infrastructure/cleaningRecordRepository";
import { createCleaningTargetRepository } from "../infrastructure/cleaningTargetRepository";

/*
 * 記録の保存（ユースケース）。画面（`../presentation/recordActions.ts`）と AI との接続（MCP）の
 * 両方から使う。猫を参照できるかは呼び出し側で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1 は引数で受け取る
 */

/**
 * 記録を追加し、その ID を返す。掃除対象が猫のもので、有効なときだけ追加し、そうでなければ null。
 * 掃除対象の ID は URL・AI から任意の値を渡せるため、他猫や無効化済みの掃除対象に記録が
 * 紐付いてしまうのを防ぐ（無効対象は編集・記録閲覧のみが仕様のため新規登録は拒否する）。
 * 掃除の通知が来ていれば、記録とあわせて完了にする（`cleaningNotificationsDueBefore`）
 */
export async function createCleaningRecord(
  catId: string,
  cleaningTargetId: string,
  data: CleaningRecordFormInput,
  actor: RecordActor,
  d1?: D1Database,
): Promise<string | null> {
  return addCleaningRecord(
    catId,
    cleaningTargetId,
    toCleaningRecordContent(data),
    actor,
    d1,
  );
}

/**
 * 「今すぐ掃除した」の記録を追加し、その ID を返す。条件は `createCleaningRecord` と同じ。
 * 手入力（combineDateTimeUtc）と同じ「naive UTC」の時刻モデルに揃える。
 * サーバー側の new Date() は実際の UTC のため、そのまま保存すると
 * JST の時計とずれた時刻で記録されてしまう
 */
export async function createCleaningRecordNow(
  catId: string,
  cleaningTargetId: string,
  actor: RecordActor,
  d1?: D1Database,
): Promise<string | null> {
  return addCleaningRecord(
    catId,
    cleaningTargetId,
    { performedAt: getNaiveUtcNow(), memo: null },
    actor,
    d1,
  );
}

async function addCleaningRecord(
  catId: string,
  cleaningTargetId: string,
  content: CleaningRecordContent,
  actor: RecordActor,
  d1?: D1Database,
): Promise<string | null> {
  const target = await createCleaningTargetRepository(d1).findScheduleForCat(
    catId,
    cleaningTargetId,
    { activeOnly: true },
  );
  if (!target) {
    return null;
  }
  return createCleaningRecordRepository(d1).add(
    catId,
    cleaningTargetId,
    content,
    cleaningNotificationsDueBefore(target, content.performedAt),
    actor,
  );
}

/**
 * 猫の掃除対象の記録を更新する。見つからなければ false。
 * 実施日時を変えたときは、その日時に記録したのと同じく掃除の通知を完了にする（先の日時から
 * 今以前に直したときなど）。メモだけを直したときは、過去の記録の修正で今の通知を完了にしないよう
 * 何もしない（ごはん記録の `updateFeedingRecord` と同じ）
 */
export async function updateCleaningRecord(
  catId: string,
  cleaningTargetId: string,
  id: string,
  data: CleaningRecordFormInput,
  actor: RecordActor,
  d1?: D1Database,
): Promise<boolean> {
  const records = createCleaningRecordRepository(d1);
  const performedAt = await records.findPerformedAt(
    catId,
    cleaningTargetId,
    id,
  );
  // 無効化済みの対象の記録も編集はできる
  const target = await createCleaningTargetRepository(d1).findScheduleForCat(
    catId,
    cleaningTargetId,
    { activeOnly: false },
  );
  if (performedAt == null || !target) {
    return false;
  }

  const content = toCleaningRecordContent(data);
  return records.update(
    catId,
    cleaningTargetId,
    id,
    content,
    content.performedAt.getTime() === performedAt.getTime()
      ? null
      : cleaningNotificationsDueBefore(target, content.performedAt),
    actor,
  );
}

/** 掃除対象の記録を論理削除する（削除日時を入れ、一覧・タイムラインから除く）。見つからなければ false */
export async function deleteCleaningRecord(
  catId: string,
  cleaningTargetId: string,
  id: string,
  actor: RecordActor,
  d1?: D1Database,
): Promise<boolean> {
  return createCleaningRecordRepository(d1).remove(
    catId,
    cleaningTargetId,
    id,
    actor,
  );
}
