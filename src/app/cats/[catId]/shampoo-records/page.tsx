import { notFound } from "next/navigation";
import { TbBath } from "react-icons/tb";
import { Breadcrumb, ButtonLink, Card } from "@/components/ui";
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
        >
          記録する
        </ButtonLink>
      </div>

      {elapsedDays != null ? (
        <Card>
          <p>前回のシャンプーから{elapsedDays}日経過</p>
        </Card>
      ) : null}

      {records.length === 0 ? (
        <Card>
          <p>まだシャンプー記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/shampoo-records/new`}
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
              <Card title={formatDateTimeUtc(record.performedAt)}>
                {record.memo ? (
                  <dl className={styles.details}>
                    <dt>備考</dt>
                    <dd>{record.memo}</dd>
                  </dl>
                ) : null}
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/cats/${catId}/shampoo-records/${record.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteRecordButton
                    action={deleteShampooRecordAction.bind(
                      null,
                      catId,
                      record.id,
                    )}
                    title="シャンプー記録の削除"
                    description="このシャンプー記録を削除しますか？この操作は取り消せません。"
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
