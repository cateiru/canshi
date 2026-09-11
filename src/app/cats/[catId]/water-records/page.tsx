import { notFound } from "next/navigation";
import { TbDropletFilled } from "react-icons/tb";
import { Breadcrumb, ButtonLink, Card } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { deleteWaterRecordAction } from "@/features/water-records/actions";
import {
  MEASUREMENT_METHOD_LABEL,
  SUBJECTIVE_AMOUNT_LABEL,
} from "@/features/water-records/labels";
import { listWaterRecords } from "@/features/water-records/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type WaterRecordsPageProps = {
  params: Promise<{ catId: string }>;
};

export default async function WaterRecordsPage({
  params,
}: WaterRecordsPageProps) {
  const { catId } = await params;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const records = await listWaterRecords(catId);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "水の記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={TbDropletFilled}>
          {cat.name}の水の記録
        </RecordPageHeading>
        <ButtonLink href={`/cats/${catId}/water-records/new`} variant="primary">
          記録する
        </ButtonLink>
      </div>

      {records.length === 0 ? (
        <Card>
          <p>まだ水の記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/water-records/new`}
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
                  <dt>給水量</dt>
                  <dd>{record.suppliedAmountMl} ml</dd>
                  <dt>残量</dt>
                  <dd>
                    {record.remainingAmountMl != null
                      ? `${record.remainingAmountMl} ml`
                      : "未入力"}
                  </dd>
                  <dt>推定飲水量</dt>
                  <dd>
                    {record.estimatedIntakeMl != null
                      ? `${record.estimatedIntakeMl} ml${
                          record.hasSpill ? "（こぼれあり・参考値）" : ""
                        }`
                      : "計算不可"}
                  </dd>
                  <dt>測定方法</dt>
                  <dd>{MEASUREMENT_METHOD_LABEL[record.measurementMethod]}</dd>
                  <dt>水交換</dt>
                  <dd>{record.wasWaterChanged ? "あり" : "なし"}</dd>
                  {record.subjectiveAmount ? (
                    <>
                      <dt>主観評価</dt>
                      <dd>
                        {SUBJECTIVE_AMOUNT_LABEL[record.subjectiveAmount]}
                      </dd>
                    </>
                  ) : null}
                  {record.memo ? (
                    <>
                      <dt>備考</dt>
                      <dd>{record.memo}</dd>
                    </>
                  ) : null}
                </dl>
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/cats/${catId}/water-records/${record.id}/edit`}
                    variant="secondary"
                  >
                    編集する
                  </ButtonLink>
                  <DeleteRecordButton
                    action={deleteWaterRecordAction.bind(
                      null,
                      catId,
                      record.id,
                    )}
                    title="水の記録の削除"
                    description="この水の記録を削除しますか？この操作は取り消せません。"
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
