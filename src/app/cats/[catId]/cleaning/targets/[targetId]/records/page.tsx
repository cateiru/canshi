import { notFound } from "next/navigation";
import { PiBroomBold } from "react-icons/pi";
import { Breadcrumb, ButtonLink, Card } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { deleteCleaningRecordAction } from "@/features/cleaning/recordActions";
import { listCleaningRecords } from "@/features/cleaning/recordQueries";
import { getCleaningTargetById } from "@/features/cleaning/targetQueries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type CleaningRecordsPageProps = {
  params: Promise<{ catId: string; targetId: string }>;
};

export default async function CleaningRecordsPage({
  params,
}: CleaningRecordsPageProps) {
  const { catId, targetId } = await params;
  const [cat, cleaningTarget] = await Promise.all([
    getCatById(catId),
    getCleaningTargetById(targetId),
  ]);

  if (!cat || !cleaningTarget || cleaningTarget.catId !== catId) {
    notFound();
  }

  const records = await listCleaningRecords(targetId);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "掃除記録", href: `/cats/${catId}/cleaning` },
          { label: cleaningTarget.name },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={PiBroomBold}>
          {cleaningTarget.name}の実施記録
        </RecordPageHeading>
        {cleaningTarget.isActive ? (
          <ButtonLink
            href={`/cats/${catId}/cleaning/targets/${targetId}/records/new`}
            variant="primary"
          >
            記録する
          </ButtonLink>
        ) : null}
      </div>

      {records.length === 0 ? (
        <Card>
          <p>まだ実施記録がありません。</p>
          {cleaningTarget.isActive ? (
            <div className={styles.emptyActions}>
              <ButtonLink
                href={`/cats/${catId}/cleaning/targets/${targetId}/records/new`}
                variant="primary"
              >
                最初の記録をする
              </ButtonLink>
            </div>
          ) : null}
        </Card>
      ) : (
        <ul className={styles.list}>
          {records.map((record) => (
            <li key={record.id}>
              <Card title={formatDateTimeUtc(record.performedAt)}>
                {record.memo ? (
                  <dl className={styles.details}>
                    <dt>備考</dt>
                    <dd>{record.memo}</dd>
                  </dl>
                ) : null}
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/cats/${catId}/cleaning/targets/${targetId}/records/${record.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteRecordButton
                    action={deleteCleaningRecordAction.bind(
                      null,
                      catId,
                      targetId,
                      record.id,
                    )}
                    title="掃除記録の削除"
                    description="この掃除記録を削除しますか？この操作は取り消せません。"
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
