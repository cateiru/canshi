import { notFound } from "next/navigation";
import { TbBath, TbClock, TbPencil, TbPlus } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { deleteShampooRecordAction } from "@/features/shampoo-records/actions";
import { calculateElapsedDays } from "@/features/shampoo-records/calculations";
import { listShampooRecords } from "@/features/shampoo-records/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type ShampooRecordsPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function ShampooRecordsPage({
  params,
}: ShampooRecordsPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const records = await listShampooRecords(catId);
  const elapsedDays =
    records.length > 0
      ? calculateElapsedDays(records[0].performedAt, getNaiveUtcNow())
      : null;

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "シャンプー記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={TbBath}>
          {cat.name}のシャンプー記録
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/shampoo-records/new`}
          variant="primary"
          className={styles.createButton}
        >
          <TbPlus aria-hidden="true" size={18} />
          記録する
        </ButtonLink>
      </div>

      {elapsedDays != null ? (
        <p className={styles.elapsed}>
          <TbBath aria-hidden="true" size={20} />
          <span>
            前回のシャンプーから<strong>{elapsedDays}</strong>日経過
          </span>
        </p>
      ) : null}

      {records.length === 0 ? (
        <div className={styles.emptyState}>
          <TbBath aria-hidden="true" size={32} />
          <p>まだシャンプー記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/shampoo-records/new`}
              variant="primary"
              className={styles.createButton}
            >
              最初の記録をする
            </ButtonLink>
          </div>
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
                      href={`/cats/${catId}/shampoo-records/${record.id}/edit`}
                      variant="secondary"
                      className={styles.iconButton}
                      aria-label="編集する"
                      title="編集する"
                    >
                      <TbPencil aria-hidden="true" size={20} />
                    </ButtonLink>
                    <DeleteRecordButton
                      action={deleteShampooRecordAction.bind(
                        null,
                        catId,
                        record.id,
                      )}
                      title="シャンプー記録の削除"
                      description="このシャンプー記録を削除しますか？この操作は取り消せません。"
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
