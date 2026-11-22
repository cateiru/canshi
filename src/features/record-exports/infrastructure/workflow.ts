import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * 記録の出力のバッチ（Workflow の `RecordExportWorkflow`）を、出力の ID をインスタンスの ID にして起動する。
 * Workflow をバインドしていない環境（`next dev` の `getPlatformProxy`・Worker Previews）では起動せずに false を返す
 * （呼び出し側がリクエストの後に同じ処理を実行する）
 */
export async function startRecordExportWorkflow(
  recordExportId: string,
): Promise<boolean> {
  const workflow: Env["RECORD_EXPORT_WORKFLOW"] | undefined =
    getCloudflareContext().env.RECORD_EXPORT_WORKFLOW;
  if (!workflow) {
    return false;
  }
  await workflow.create({ id: recordExportId, params: { recordExportId } });
  return true;
}
