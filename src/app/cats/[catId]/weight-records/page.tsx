import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, Card } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { deleteWeightRecordAction } from "@/features/weight-records/actions";
import { INPUT_METHOD_LABEL } from "@/features/weight-records/labels";
import { listWeightRecords } from "@/features/weight-records/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type WeightRecordsPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function WeightRecordsPage({
  params,
}: WeightRecordsPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const records = await listWeightRecords(catId);

  return (
    <main className={styles.main}>
      <Link href={`/cats/${catId}`} className={styles.backLink}>
        ← {cat.name}のページに戻る
      </Link>

      <div className={styles.header}>
        <h1>{cat.name}の体重記録</h1>
        <ButtonLink
          href={`/cats/${catId}/weight-records/new`}
          variant="primary"
        >
          記録する
        </ButtonLink>
      </div>

      {records.length === 0 ? (
        <Card>
          <p>まだ体重記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/weight-records/new`}
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
                  <dt>体重</dt>
                  <dd>{record.catWeightKg.toFixed(2)} kg</dd>
                  <dt>入力方法</dt>
                  <dd>{INPUT_METHOD_LABEL[record.inputMethod]}</dd>
                </dl>
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/cats/${catId}/weight-records/${record.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteRecordButton
                    action={deleteWeightRecordAction.bind(
                      null,
                      catId,
                      record.id,
                    )}
                    title="体重記録の削除"
                    description="この体重記録を削除しますか？この操作は取り消せません。"
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
