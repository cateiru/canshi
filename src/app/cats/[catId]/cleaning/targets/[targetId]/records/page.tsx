import { notFound } from "next/navigation";
import { TbClock, TbPencil, TbPlus } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import { BroomIcon } from "@/components/ui/RecordIcons/RecordIcons";
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
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "掃除記録", href: `/cats/${catId}/cleaning` },
          { label: cleaningTarget.name },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={BroomIcon}>
          {cleaningTarget.name}の実施記録
        </RecordPageHeading>
        {cleaningTarget.isActive ? (
          <ButtonLink
            href={`/cats/${catId}/cleaning/targets/${targetId}/records/new`}
            variant="primary"
            className={styles.createButton}
          >
            <TbPlus aria-hidden="true" size={18} />
            記録する
          </ButtonLink>
        ) : null}
      </div>

      {records.length === 0 ? (
        <div className={styles.emptyState}>
          <BroomIcon aria-hidden="true" size={32} />
          <p>まだ実施記録がありません。</p>
          {cleaningTarget.isActive ? (
            <div className={styles.emptyActions}>
              <ButtonLink
                href={`/cats/${catId}/cleaning/targets/${targetId}/records/new`}
                variant="primary"
                className={styles.createButton}
              >
                最初の記録をする
              </ButtonLink>
            </div>
          ) : null}
        </div>
      ) : (
        <ul className={styles.list}>
          {records.map((record) => (
            <li key={record.id}>
              <article
                className={styles.record}
                aria-label={formatDateTimeUtc(record.performedAt)}
              >
                <div className={styles.recordHeader}>
                  <h2 className={styles.recordDate}>
                    <TbClock aria-hidden="true" size={18} />
                    <time dateTime={record.performedAt.toISOString()}>
                      {formatDateTimeUtc(record.performedAt)}
                    </time>
                  </h2>
                  <div className={styles.cardActions}>
                    <ButtonLink
                      href={`/cats/${catId}/cleaning/targets/${targetId}/records/${record.id}/edit`}
                      variant="secondary"
                      className={styles.iconButton}
                      aria-label="編集する"
                      title="編集する"
                    >
                      <TbPencil aria-hidden="true" size={20} />
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
                      iconOnly
                      className={styles.iconButton}
                    />
                  </div>
                </div>

                {record.memo ? (
                  <dl className={styles.details}>
                    <div>
                      <dt>備考</dt>
                      <dd>{record.memo}</dd>
                    </div>
                  </dl>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
