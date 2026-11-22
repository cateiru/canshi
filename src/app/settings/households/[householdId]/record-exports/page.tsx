import { RecordExportIcon } from "@canshi/shared/ui/RecordIcons";
import type { Metadata } from "next";
import { Alert, Breadcrumb, Heading, RecordEmptyState } from "@/components/ui";
import { requireHouseholdAccess } from "@/features/auth/presentation/session";
import { recordExportDisplayStatus } from "@/features/record-exports/domain/recordExport";
import { listRecordExports } from "@/features/record-exports/infrastructure/queries";
import { requestRecordExportAction } from "@/features/record-exports/presentation/actions";
import { RecordExportForm } from "@/features/record-exports/presentation/RecordExportForm";
import { RecordExportList } from "@/features/record-exports/presentation/RecordExportList";
import { RecordExportPolling } from "@/features/record-exports/presentation/RecordExportPolling";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "記録の出力",
};

export const dynamic = "force-dynamic";

type RecordExportsPageProps = {
  params: Promise<{ householdId: string }>;
};

export default async function RecordExportsPage({
  params,
}: RecordExportsPageProps) {
  const { householdId } = await params;
  const { household } = await requireHouseholdAccess(householdId);
  const recordExports = await listRecordExports(household.id);
  const now = new Date();
  const isRunning = recordExports.some(
    (recordExport) =>
      recordExportDisplayStatus(recordExport, now) === "running",
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "設定", href: "/settings" },
          { label: "家の設定", href: "/settings/households" },
          {
            label: household.name,
            href: `/settings/households/${household.id}`,
          },
          { label: "記録の出力" },
        ]}
      />

      <RecordPageHeading icon={RecordExportIcon}>記録の出力</RecordPageHeading>

      <div className={styles.description}>
        <p>
          この家の記録を CSV ファイルに書き出し、zip
          ファイルにまとめてダウンロードできます。表計算ソフトで見返したり、ほかのアプリに移したりするときに使えます。
        </p>
        <p className={styles.note}>
          出力には時間がかかることがあります。このページを離れても出力は続き、完了すると家のメンバーの誰でもダウンロードできます。
        </p>
      </div>

      <Surface title="出力する" titleId="record-export-new-heading" gap="md">
        {isRunning ? (
          <Alert color="info">
            出力を処理しています。完了するまで、新しく出力することはできません。
          </Alert>
        ) : null}
        <RecordExportForm
          action={requestRecordExportAction.bind(null, household.id)}
          isRunning={isRunning}
        />
      </Surface>

      <section
        aria-labelledby="record-exports-heading"
        className={styles.section}
      >
        <Heading level={2} size="md" id="record-exports-heading">
          出力したファイル
        </Heading>
        {recordExports.length > 0 ? (
          <RecordExportList
            householdId={household.id}
            recordExports={recordExports}
            now={now}
          />
        ) : (
          <RecordEmptyState icon={RecordExportIcon}>
            まだ出力したファイルはありません。
          </RecordEmptyState>
        )}
      </section>

      {isRunning ? <RecordExportPolling householdId={household.id} /> : null}
    </main>
  );
}
