import { notFound } from "next/navigation";
import { TbToiletPaper } from "react-icons/tb";
import { Badge, Breadcrumb, ButtonLink, Card } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { deleteVomitRecordAction } from "@/features/vomit-records/actions";
import { listVomitRecords } from "@/features/vomit-records/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type VomitRecordsPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function VomitRecordsPage({
  params,
}: VomitRecordsPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const records = await listVomitRecords(catId);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "嘔吐記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={TbToiletPaper}>
          {cat.name}の嘔吐記録
        </RecordPageHeading>
        <ButtonLink href={`/cats/${catId}/vomit-records/new`} variant="primary">
          記録する
        </ButtonLink>
      </div>

      {records.length === 0 ? (
        <Card>
          <p>まだ嘔吐記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/vomit-records/new`}
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
                    href={`/cats/${catId}/vomit-records/${record.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteRecordButton
                    action={deleteVomitRecordAction.bind(
                      null,
                      catId,
                      record.id,
                    )}
                    title="嘔吐記録の削除"
                    description="この嘔吐記録を削除しますか？この操作は取り消せません。"
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
