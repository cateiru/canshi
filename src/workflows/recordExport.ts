import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import {
  failRecordExport,
  runRecordExport,
} from "@/features/record-exports/application/mutations";

export type RecordExportWorkflowParams = { recordExportId: string };

/**
 * 記録の出力（#286）のバッチ。家のメンバーが出力を依頼すると、Server Action
 * （`src/features/record-exports/presentation/actions.ts`）が出力の ID でインスタンスを作る。
 * zip を作って R2 に置き、出力を完了にする。何度やり直しても失敗したら、出力を失敗にする。
 *
 * Workflow のステップはリクエストの外で実行されるため `getCloudflareContext()` が使えない。
 * そのため自身の `this.env` の D1・R2 を明示的に渡す
 */
export class RecordExportWorkflow extends WorkflowEntrypoint<
  Env,
  RecordExportWorkflowParams
> {
  async run(
    event: WorkflowEvent<RecordExportWorkflowParams>,
    step: WorkflowStep,
  ): Promise<void> {
    const { recordExportId } = event.payload;
    const env = { DB: this.env.DB, MEDIA_BUCKET: this.env.MEDIA_BUCKET };
    try {
      await step.do(
        "build archive",
        {
          retries: { limit: 2, delay: "30 seconds", backoff: "exponential" },
          timeout: "30 minutes",
        },
        async () => {
          await runRecordExport(recordExportId, env);
        },
      );
    } catch (error) {
      console.error(
        `記録の出力に失敗しました（recordExport=${recordExportId}）`,
        error,
      );
      await step.do("mark failed", async () => {
        await failRecordExport(recordExportId, env);
      });
    }
  }
}
