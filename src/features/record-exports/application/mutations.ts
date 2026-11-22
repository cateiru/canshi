import { getNaiveUtcNow } from "@/features/shared/datetime";
import {
  normalizeRecordExportTypes,
  recordExportObjectKey,
  recordExportStaleBefore,
} from "../domain/recordExport";
import type { RecordExportFormInput } from "../domain/schema";
import { loadRecordExportContents } from "../infrastructure/exportContents";
import { createRecordExportRepository } from "../infrastructure/recordExportRepository";
import {
  deleteRecordExportObjects,
  encodeCsvFiles,
  getRecordExportEnv,
  type RecordExportEnv,
  writeRecordExportArchive,
} from "../infrastructure/storage";
import { fitsInZip, ZipTooLargeError } from "../infrastructure/zip";

/*
 * 記録の出力（ユースケース）。家のメンバーなら誰でも依頼・削除できる。
 * メンバーであること・処理中の出力がないことはリポジトリの文の中で確かめる
 */

export type RequestRecordExportResult =
  | { ok: true; recordExportId: string }
  | { ok: false; error: string };

export const RECORD_EXPORT_RUNNING_ERROR =
  "ほかの出力を処理中のため、出力できませんでした。完了してからもう一度お試しください。";

/**
 * 記録の出力を依頼する（`pending` の行を作る）。バッチの起動は呼び出し側が行う。
 * 家に処理中の出力があれば依頼できない
 */
export async function requestRecordExport(
  householdId: string,
  userId: string,
  input: RecordExportFormInput,
  now: Date = new Date(),
  d1?: D1Database,
): Promise<RequestRecordExportResult> {
  const recordExportId = await createRecordExportRepository(d1).addForMember(
    householdId,
    userId,
    { recordTypes: input.recordTypes, includeMedia: input.includeMedia },
    recordExportStaleBefore(now),
  );
  if (!recordExportId) {
    return { ok: false, error: RECORD_EXPORT_RUNNING_ERROR };
  }
  return { ok: true, recordExportId };
}

/**
 * 出力のバッチの本体。zip を作って R2 に置き、出力を完了にする。Workflow（`RecordExportWorkflow`）と、
 * Workflow を使えない環境ではリクエストの後に呼ぶ。
 *
 * - すでに完了・失敗した出力や、削除された出力は何もしない（Workflow のやり直しで呼ばれても重ねて作らない）
 * - zip の大きさ・ファイル数が上限を超えるときは、やり直しても同じため、例外にせず失敗（`too_large`）にする
 * - それ以外の失敗は例外にする（Workflow はやり直し、やり直しても失敗したら `failRecordExport` を呼ぶ）
 */
export async function runRecordExport(
  recordExportId: string,
  env?: RecordExportEnv,
): Promise<void> {
  const resolved = getRecordExportEnv(env);
  const repository = createRecordExportRepository(resolved.DB);
  const recordExport = await repository.markProcessing(recordExportId);
  if (!recordExport) {
    return;
  }

  const contents = await loadRecordExportContents(
    recordExport.householdId,
    normalizeRecordExportTypes(recordExport.recordTypes),
    recordExport.includeMedia,
    resolved.DB,
  );
  const csvFiles = encodeCsvFiles(contents);
  const fits = fitsInZip([
    ...csvFiles.map(({ name, bytes }) => ({
      name,
      sizeBytes: bytes.byteLength,
    })),
    ...contents.media.map(({ path, sizeBytes }) => ({ name: path, sizeBytes })),
  ]);
  if (!fits) {
    await repository.markFailed(recordExportId, "too_large");
    return;
  }

  const objectKey = recordExportObjectKey(recordExportId);
  let sizeBytes: number;
  try {
    sizeBytes = await writeRecordExportArchive(
      resolved,
      objectKey,
      csvFiles,
      contents.media,
      // zip の中のファイルの日時は、依頼した日時（日本時間）にする
      getNaiveUtcNow(recordExport.createdAt),
    );
  } catch (error) {
    if (error instanceof ZipTooLargeError) {
      await repository.markFailed(recordExportId, "too_large");
      return;
    }
    throw error;
  }

  const completed = await repository.markCompleted(
    recordExportId,
    objectKey,
    sizeBytes,
  );
  if (!completed) {
    // 書き出している間に出力（家の削除を含む）が削除された。置いた zip を片付ける
    await deleteRecordExportObjects([objectKey], resolved);
  }
}

/** バッチが失敗した出力を失敗にする。処理中でなければ何もしない */
export async function failRecordExport(
  recordExportId: string,
  env?: RecordExportEnv,
): Promise<void> {
  await createRecordExportRepository(getRecordExportEnv(env).DB).markFailed(
    recordExportId,
    "error",
  );
}

export type DeleteRecordExportResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * 出力を削除する。家のメンバーなら誰でも削除できる。処理中の出力は削除できない（処理中のまま
 * 止まったものは削除できる）。zip は行を削除してから R2 から消し、消せなくても削除は成功として扱う
 */
export async function deleteRecordExport(
  householdId: string,
  userId: string,
  recordExportId: string,
  now: Date = new Date(),
): Promise<DeleteRecordExportResult> {
  const removed = await createRecordExportRepository().removeForMember(
    householdId,
    userId,
    recordExportId,
    recordExportStaleBefore(now),
  );
  if (!removed) {
    return {
      ok: false,
      error: "出力を削除できませんでした。処理中の出力は削除できません。",
    };
  }
  if (removed.objectKey) {
    try {
      await deleteRecordExportObjects([removed.objectKey]);
    } catch (error) {
      console.error(
        `記録の出力の zip を削除できませんでした（${removed.objectKey}）`,
        error,
      );
    }
  }
  return { ok: true };
}
