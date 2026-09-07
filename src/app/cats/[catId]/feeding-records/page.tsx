import Link from "next/link";
import { notFound } from "next/navigation";
import { TbMeat } from "react-icons/tb";
import { ButtonLink, Card } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { deleteFeedingRecordAction } from "@/features/feeding-records/actions";
import { listFeedingRecords } from "@/features/feeding-records/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type FeedingRecordsPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function FeedingRecordsPage({
  params,
}: FeedingRecordsPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const records = await listFeedingRecords(catId);

  return (
    <main className={styles.main}>
      <Link href={`/cats/${catId}`} className={styles.backLink}>
        ← {cat.name}のページに戻る
      </Link>

      <div className={styles.header}>
        <RecordPageHeading icon={TbMeat}>
          {cat.name}のごはん記録
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/feeding-records/new`}
          variant="primary"
        >
          記録する
        </ButtonLink>
      </div>

      {records.length === 0 ? (
        <Card>
          <p>まだごはん記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/feeding-records/new`}
              variant="primary"
            >
              最初の記録をする
            </ButtonLink>
          </div>
        </Card>
      ) : (
        <ul className={styles.list}>
          {records.map((record) => (
            <li key={record.id}>
              <Card title={formatDateTimeUtc(record.occurredAt)}>
                <dl className={styles.details}>
                  <dt>商品</dt>
                  <dd>{record.foodProductName}</dd>
                  <dt>与えた量</dt>
                  <dd>{record.givenAmountG} g</dd>
                  <dt>残した量</dt>
                  <dd>{record.leftoverAmountG} g</dd>
                  <dt>推定摂取量</dt>
                  <dd>{record.estimatedIntakeG} g</dd>
                  <dt>推定摂取カロリー</dt>
                  <dd>{record.estimatedKcal.toFixed(1)} kcal</dd>
                </dl>
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/cats/${catId}/feeding-records/${record.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteRecordButton
                    action={deleteFeedingRecordAction.bind(
                      null,
                      catId,
                      record.id,
                    )}
                    title="ごはん記録の削除"
                    description="このごはん記録を削除しますか？この操作は取り消せません。"
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
