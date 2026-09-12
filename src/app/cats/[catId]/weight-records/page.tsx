import { notFound } from "next/navigation";
import { TbClock, TbPencil, TbPlus, TbWeight } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
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
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "体重記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={TbWeight}>
          {cat.name}の体重記録
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/weight-records/new`}
          variant="primary"
          className={styles.createButton}
        >
          <TbPlus aria-hidden="true" size={18} />
          記録する
        </ButtonLink>
      </div>

      {records.length === 0 ? (
        <div className={styles.emptyState}>
          <TbWeight aria-hidden="true" size={32} />
          <p>まだ体重記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/weight-records/new`}
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
                      href={`/cats/${catId}/weight-records/${record.id}/edit`}
                      variant="secondary"
                      className={styles.iconButton}
                      aria-label="編集する"
                      title="編集する"
                    >
                      <TbPencil aria-hidden="true" size={20} />
                    </ButtonLink>
                    <DeleteRecordButton
                      action={deleteWeightRecordAction.bind(
                        null,
                        catId,
                        record.id,
                      )}
                      title="体重記録の削除"
                      description="この体重記録を削除しますか？この操作は取り消せません。"
                      iconOnly
                      className={styles.iconButton}
                    />
                  </div>
                </div>

                <dl className={styles.summary}>
                  <dt>
                    <TbWeight aria-hidden="true" size={18} />
                    体重
                  </dt>
                  <dd>
                    {record.catWeightKg.toFixed(2)}
                    <span>kg</span>
                  </dd>
                </dl>

                <dl className={styles.details}>
                  <div>
                    <dt>入力方法</dt>
                    <dd>{INPUT_METHOD_LABEL[record.inputMethod]}</dd>
                  </div>
                </dl>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
