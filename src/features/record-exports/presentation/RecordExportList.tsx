import { TbDownload } from "react-icons/tb";
import {
  AnchorLink,
  Badge,
  type BadgeColor,
  ButtonLink,
  RecordCard,
} from "@/components/ui";
import { HouseholdMemberActionButton } from "@/features/households/presentation/HouseholdMemberActionButton";
import { formatBytes } from "@/features/media/domain/limits";
import { formatTimestampJst } from "@/features/shared/datetime";
import {
  normalizeRecordExportTypes,
  RECORD_EXPORT_STATUS_LABEL,
  RECORD_EXPORT_TYPE_LABEL,
  type RecordExportDisplayStatus,
  recordExportDisplayStatus,
  recordExportFailureMessage,
} from "../domain/recordExport";
import type { RecordExportListItem } from "../infrastructure/queries";
import { deleteRecordExportAction } from "./actions";
import { recordExportDownloadPath } from "./paths";
import styles from "./RecordExportList.module.css";

const STATUS_BADGE_COLOR: Record<RecordExportDisplayStatus, BadgeColor> = {
  running: "info",
  completed: "success",
  failed: "error",
};

type RecordExportListProps = {
  householdId: string;
  recordExports: RecordExportListItem[];
  now: Date;
};

/** 家の記録の出力の一覧。完了した出力はダウンロードでき、処理中でない出力は削除できる */
export function RecordExportList({
  householdId,
  recordExports,
  now,
}: RecordExportListProps) {
  return (
    <ul className={styles.list}>
      {recordExports.map((recordExport) => {
        const status = recordExportDisplayStatus(recordExport, now);
        const requestedAt = formatTimestampJst(recordExport.createdAt);
        const typeLabels = normalizeRecordExportTypes(
          recordExport.recordTypes,
        ).map((type) => RECORD_EXPORT_TYPE_LABEL[type]);
        return (
          <li key={recordExport.id}>
            <RecordCard
              className={styles.item}
              aria-label={`${requestedAt}に依頼した出力`}
            >
              <div className={styles.header}>
                <h3 className={styles.title}>
                  <time dateTime={recordExport.createdAt.toISOString()}>
                    {requestedAt}
                  </time>
                </h3>
                <Badge color={STATUS_BADGE_COLOR[status]}>
                  {RECORD_EXPORT_STATUS_LABEL[status]}
                </Badge>
              </div>
              <dl className={styles.details}>
                <dt>記録</dt>
                <dd>{typeLabels.join("・")}</dd>
                <dt>写真・動画</dt>
                <dd>{recordExport.includeMedia ? "含める" : "含めない"}</dd>
                <dt>依頼した人</dt>
                <dd>{recordExport.requestedByName}</dd>
                {status === "completed" && recordExport.sizeBytes != null ? (
                  <>
                    <dt>大きさ</dt>
                    <dd>{formatBytes(recordExport.sizeBytes)}</dd>
                  </>
                ) : null}
              </dl>
              {status === "running" ? (
                <p className={styles.note}>
                  出力しています。完了するとダウンロードできます。
                </p>
              ) : null}
              {status === "failed" ? (
                <p className={styles.error}>
                  {recordExportFailureMessage(recordExport.failureReason)}
                </p>
              ) : null}
              {status === "running" ? null : (
                <div className={styles.actions}>
                  {status === "completed" ? (
                    <ButtonLink
                      href={recordExportDownloadPath(
                        householdId,
                        recordExport.id,
                      )}
                      // ページの移動ではなくファイルのダウンロードのため、next/link ではなく素の <a> にする
                      linkComponent={AnchorLink}
                      download
                      variant="primary"
                      leftIcon={TbDownload}
                    >
                      ダウンロード
                    </ButtonLink>
                  ) : null}
                  <HouseholdMemberActionButton
                    iconOnly
                    iconLabel={`${requestedAt}に依頼した出力を削除する`}
                    label="削除する"
                    title="出力の削除"
                    description={`${requestedAt}に依頼した出力を削除しますか？家のメンバーの誰もダウンロードできなくなります。記録そのものは削除されません。`}
                    variant="danger"
                    successMessage="出力を削除しました"
                    action={deleteRecordExportAction.bind(
                      null,
                      householdId,
                      recordExport.id,
                    )}
                  />
                </div>
              )}
            </RecordCard>
          </li>
        );
      })}
    </ul>
  );
}
