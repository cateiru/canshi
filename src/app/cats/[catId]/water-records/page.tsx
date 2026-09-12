import { notFound } from "next/navigation";
import { TbClock, TbDroplet, TbPencil, TbPlus } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
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
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "水の記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={TbDroplet}>
          {cat.name}の水の記録
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/water-records/new`}
          variant="primary"
          className={styles.createButton}
        >
          <TbPlus aria-hidden="true" size={18} />
          記録する
        </ButtonLink>
      </div>

      {records.length === 0 ? (
        <div className={styles.emptyState}>
          <TbDroplet aria-hidden="true" size={32} />
          <p>まだ水の記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/water-records/new`}
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
                aria-label={formatDateTimeUtc(record.occurredAt)}
              >
                <div className={styles.recordHeader}>
                  <h2 className={styles.recordDate}>
                    <TbClock aria-hidden="true" size={18} />
                    <time dateTime={record.occurredAt.toISOString()}>
                      {formatDateTimeUtc(record.occurredAt)}
                    </time>
                  </h2>
                  <div className={styles.cardActions}>
                    <ButtonLink
                      href={`/cats/${catId}/water-records/${record.id}/edit`}
                      variant="secondary"
                      className={styles.iconButton}
                      aria-label="編集する"
                      title="編集する"
                    >
                      <TbPencil aria-hidden="true" size={20} />
                    </ButtonLink>
                    <DeleteRecordButton
                      action={deleteWaterRecordAction.bind(
                        null,
                        catId,
                        record.id,
                      )}
                      title="水の記録の削除"
                      description="この水の記録を削除しますか？この操作は取り消せません。"
                      iconOnly
                      className={styles.iconButton}
                    />
                  </div>
                </div>

                <dl className={styles.summary} aria-label="給水の合計">
                  <div>
                    <dt>
                      <TbDroplet aria-hidden="true" size={18} />
                      給水量
                    </dt>
                    <dd>
                      {record.suppliedAmountMl}
                      <span>ml</span>
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <TbDroplet aria-hidden="true" size={18} />
                      推定飲水量
                      {record.hasSpill ? (
                        <span className={styles.estimate}>（参考値）</span>
                      ) : null}
                    </dt>
                    <dd>
                      {record.estimatedIntakeMl != null
                        ? record.estimatedIntakeMl
                        : "―"}
                      <span>ml</span>
                    </dd>
                  </div>
                </dl>

                <dl className={styles.details}>
                  <div>
                    <dt>残量</dt>
                    <dd>
                      {record.remainingAmountMl != null
                        ? `${record.remainingAmountMl} ml`
                        : "未入力"}
                    </dd>
                  </div>
                  <div>
                    <dt>測定方法</dt>
                    <dd>
                      {MEASUREMENT_METHOD_LABEL[record.measurementMethod]}
                    </dd>
                  </div>
                  <div>
                    <dt>水交換</dt>
                    <dd>{record.wasWaterChanged ? "あり" : "なし"}</dd>
                  </div>
                  {record.subjectiveAmount ? (
                    <div>
                      <dt>主観評価</dt>
                      <dd>
                        {SUBJECTIVE_AMOUNT_LABEL[record.subjectiveAmount]}
                      </dd>
                    </div>
                  ) : null}
                  {record.memo ? (
                    <div>
                      <dt>備考</dt>
                      <dd>{record.memo}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
