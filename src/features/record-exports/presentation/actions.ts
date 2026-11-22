"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireHouseholdAccess } from "@/features/auth/presentation/session";
import type { HouseholdMemberActionResult } from "@/features/households/presentation/actions";
import {
  deleteRecordExport,
  failRecordExport,
  requestRecordExport,
  runRecordExport,
} from "../application/mutations";
import {
  type RecordExportFormFieldErrors,
  recordExportFormSchema,
} from "../domain/schema";
import { getRecordExportEnv } from "../infrastructure/storage";
import { startRecordExportWorkflow } from "../infrastructure/workflow";
import { recordExportsPath } from "./paths";

export type RecordExportFormState = {
  fieldErrors?: RecordExportFormFieldErrors;
  formError?: string;
  /** 依頼を受け付けたときに、フォームの下に表示するメッセージ */
  message?: string;
};

/**
 * 記録の出力を依頼し、バッチを起動する。依頼後も同じページにとどまり、処理中の表示にする
 * （ページが 1 秒ごとに状態を確かめ、完了したら一覧を表示し直す）
 */
export async function requestRecordExportAction(
  householdId: string,
  _prevState: RecordExportFormState,
  formData: FormData,
): Promise<RecordExportFormState> {
  const { user } = await requireHouseholdAccess(householdId);
  const parsed = recordExportFormSchema.safeParse({
    recordTypes: formData.getAll("recordTypes"),
    includeMedia: formData.get("includeMedia"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const result = await requestRecordExport(householdId, user.id, parsed.data);
  if (!result.ok) {
    return { formError: result.error };
  }

  const started = await startRecordExport(result.recordExportId);
  revalidatePath(recordExportsPath(householdId));
  if (!started) {
    return {
      formError:
        "出力を始められませんでした。時間をおいてもう一度お試しください。",
    };
  }
  return {
    message: "出力を始めました。完了すると、下の一覧からダウンロードできます。",
  };
}

/**
 * 出力のバッチを起動する。Workflow をバインドしていない環境（`next dev`・Worker Previews）では、
 * 応答を返した後に同じ処理を実行する（Worker Previews では `waitUntil` の時間の上限があるため、
 * 大きな出力は終わらないことがある）。起動できなければ出力を失敗にして false を返す
 */
async function startRecordExport(recordExportId: string): Promise<boolean> {
  try {
    if (await startRecordExportWorkflow(recordExportId)) {
      return true;
    }
  } catch (error) {
    console.error(
      `記録の出力のバッチを起動できませんでした（recordExport=${recordExportId}）`,
      error,
    );
    await failRecordExport(recordExportId);
    return false;
  }

  const env = getRecordExportEnv();
  after(async () => {
    try {
      await runRecordExport(recordExportId, env);
    } catch (error) {
      console.error(
        `記録の出力に失敗しました（recordExport=${recordExportId}）`,
        error,
      );
      await failRecordExport(recordExportId, env);
    }
  });
  return true;
}

/** 出力を削除する。処理中の出力は削除できない */
export async function deleteRecordExportAction(
  householdId: string,
  recordExportId: string,
): Promise<HouseholdMemberActionResult> {
  const { user } = await requireHouseholdAccess(householdId);
  const result = await deleteRecordExport(householdId, user.id, recordExportId);
  return result.ok ? {} : { error: result.error };
}
