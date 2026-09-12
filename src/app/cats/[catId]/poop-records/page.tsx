import { notFound } from "next/navigation";
import { TbClock, TbPencil, TbPlus } from "react-icons/tb";
import { Badge, Breadcrumb, ButtonLink } from "@/components/ui";
import { PoopIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById } from "@/features/cats/queries";
import { MediaGallery } from "@/features/media/MediaGallery";
import { listMediaAssetsByRecords } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
import { deletePoopRecordAction } from "@/features/poop-records/actions";
import { CONSISTENCY_LABEL } from "@/features/poop-records/labels";
import { POOP_RECORD_MEDIA_TYPE } from "@/features/poop-records/media";
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
  const mediaByRecordId = await listMediaAssetsByRecords(
    POOP_RECORD_MEDIA_TYPE,
    records.map((record) => record.id),
  );

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "うんち記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={PoopIcon}>
          {cat.name}のうんち記録
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/poop-records/new`}
          variant="primary"
          className={styles.createButton}
        >
          <TbPlus aria-hidden="true" size={18} />
          記録する
        </ButtonLink>
      </div>

      {records.length === 0 ? (
        <div className={styles.emptyState}>
          <PoopIcon aria-hidden="true" size={32} />
          <p>まだうんち記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/poop-records/new`}
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
                      href={`/cats/${catId}/poop-records/${record.id}/edit`}
                      variant="secondary"
                      className={styles.iconButton}
                      aria-label="編集する"
                      title="編集する"
                    >
                      <TbPencil aria-hidden="true" size={20} />
                    </ButtonLink>
                    <DeleteRecordButton
                      action={deletePoopRecordAction.bind(
                        null,
                        catId,
                        record.id,
                      )}
                      title="うんち記録の削除"
                      description="このうんち記録を削除しますか？この操作は取り消せません。"
                      iconOnly
                      className={styles.iconButton}
                    />
                  </div>
                </div>

                <dl className={styles.details}>
                  <div>
                    <dt>状態</dt>
                    <dd>{CONSISTENCY_LABEL[record.consistency]}</dd>
                  </div>
                  {record.amount ? (
                    <div>
                      <dt>量</dt>
                      <dd>{record.amount}</dd>
                    </div>
                  ) : null}
                  {record.color ? (
                    <div>
                      <dt>色</dt>
                      <dd>{record.color}</dd>
                    </div>
                  ) : null}
                  {record.appetiteNote ? (
                    <div>
                      <dt>食欲</dt>
                      <dd>{record.appetiteNote}</dd>
                    </div>
                  ) : null}
                  {record.energyNote ? (
                    <div>
                      <dt>元気</dt>
                      <dd>{record.energyNote}</dd>
                    </div>
                  ) : null}
                  {record.memo ? (
                    <div>
                      <dt>備考</dt>
                      <dd>{record.memo}</dd>
                    </div>
                  ) : null}
                </dl>

                {record.hasBlood || record.hasForeignObject ? (
                  <div className={styles.badges}>
                    {record.hasBlood ? (
                      <Badge color="error">血液あり</Badge>
                    ) : null}
                    {record.hasForeignObject ? (
                      <Badge color="warning">異物あり</Badge>
                    ) : null}
                  </div>
                ) : null}

                <div className={styles.media}>
                  <MediaGallery
                    assets={(mediaByRecordId.get(record.id) ?? []).map(
                      toMediaAssetView,
                    )}
                    title="うんちの写真"
                  />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
