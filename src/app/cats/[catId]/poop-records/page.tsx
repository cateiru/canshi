import { notFound } from "next/navigation";
import { FaPoop } from "react-icons/fa";
import { Badge, Breadcrumb, ButtonLink, Card } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { deletePoopRecordAction } from "@/features/poop-records/actions";
import { CONSISTENCY_LABEL } from "@/features/poop-records/labels";
import { listPoopRecords } from "@/features/poop-records/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PoopRecordsPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function PoopRecordsPage({
  params,
}: PoopRecordsPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const records = await listPoopRecords(catId);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "うんち記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={FaPoop}>
          {cat.name}のうんち記録
        </RecordPageHeading>
        <ButtonLink href={`/cats/${catId}/poop-records/new`} variant="primary">
          記録する
        </ButtonLink>
      </div>

      {records.length === 0 ? (
        <Card>
          <p>まだうんち記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/poop-records/new`}
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
                  <dt>回数</dt>
                  <dd>{record.count}回</dd>
                  <dt>状態</dt>
                  <dd>{CONSISTENCY_LABEL[record.consistency]}</dd>
                  {record.amount ? (
                    <>
                      <dt>量</dt>
                      <dd>{record.amount}</dd>
                    </>
                  ) : null}
                  {record.color ? (
                    <>
                      <dt>色</dt>
                      <dd>{record.color}</dd>
                    </>
                  ) : null}
                  {record.appetiteNote ? (
                    <>
                      <dt>食欲</dt>
                      <dd>{record.appetiteNote}</dd>
                    </>
                  ) : null}
                  {record.energyNote ? (
                    <>
                      <dt>元気</dt>
                      <dd>{record.energyNote}</dd>
                    </>
                  ) : null}
                  {record.memo ? (
                    <>
                      <dt>備考</dt>
                      <dd>{record.memo}</dd>
                    </>
                  ) : null}
                </dl>
                <div className={styles.badges}>
                  {record.hasBlood ? (
                    <Badge color="error">血液あり</Badge>
                  ) : null}
                  {record.hasForeignObject ? (
                    <Badge color="warning">異物あり</Badge>
                  ) : null}
                </div>
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/cats/${catId}/poop-records/${record.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteRecordButton
                    action={deletePoopRecordAction.bind(null, catId, record.id)}
                    title="うんち記録の削除"
                    description="このうんち記録を削除しますか？この操作は取り消せません。"
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
