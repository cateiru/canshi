import { notFound } from "next/navigation";
import { TbClock, TbFlame, TbPencil, TbPlus } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import { FeedingIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById } from "@/features/cats/queries";
import { deleteFeedingRecordAction } from "@/features/feeding-records/actions";
import { listFeedingRecords } from "@/features/feeding-records/queries";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
import { listFoodProductImageUrls } from "@/features/food-products/queries";
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
  const foodProductImageUrls = await listFoodProductImageUrls([
    ...new Set(
      records.flatMap((record) =>
        record.items.map((item) => item.foodProductId),
      ),
    ),
  ]);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "ごはん記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={FeedingIcon}>
          {cat.name}のごはん記録
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/feeding-records/new`}
          variant="primary"
          className={styles.createButton}
        >
          <TbPlus aria-hidden="true" size={18} />
          記録する
        </ButtonLink>
      </div>

      {records.length === 0 ? (
        <div className={styles.emptyState}>
          <FeedingIcon aria-hidden="true" size={32} />
          <p>まだごはん記録がありません。</p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/feeding-records/new`}
              variant="primary"
              className={styles.createButton}
            >
              最初の記録をする
            </ButtonLink>
          </div>
        </div>
      ) : (
        <ul className={styles.list}>
          {records.map((record) => {
            const totalIntakeG = record.items.reduce(
              (sum, item) => sum + item.estimatedIntakeG,
              0,
            );
            const totalKcal = record.items.reduce(
              (sum, item) => sum + item.estimatedKcal,
              0,
            );

            return (
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
                        href={`/cats/${catId}/feeding-records/${record.id}/edit`}
                        variant="secondary"
                        className={styles.iconButton}
                        aria-label="編集する"
                        title="編集する"
                      >
                        <TbPencil aria-hidden="true" size={20} />
                      </ButtonLink>
                      <DeleteRecordButton
                        action={deleteFeedingRecordAction.bind(
                          null,
                          catId,
                          record.id,
                        )}
                        title="ごはん記録の削除"
                        description="このごはん記録を削除しますか？この操作は取り消せません。"
                        iconOnly
                        className={styles.iconButton}
                      />
                    </div>
                  </div>
                  <ul className={styles.itemsList}>
                    {record.items.map((item) => (
                      <li key={item.id} className={styles.product}>
                        <span className={styles.productImage}>
                          <FoodProductImage
                            name={item.foodProductName}
                            thumbnailUrl={
                              foodProductImageUrls[item.foodProductId]
                            }
                          />
                        </span>
                        <div className={styles.productInfo}>
                          <h3 className={styles.productName}>
                            {item.foodProductName}
                          </h3>
                          <dl className={styles.amounts}>
                            <div>
                              <dt>与えた量</dt>
                              <dd>{item.givenAmountG} g</dd>
                            </div>
                            <div>
                              <dt>残した量</dt>
                              <dd>{item.leftoverAmountG} g</dd>
                            </div>
                          </dl>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <dl
                    className={styles.summary}
                    aria-label="食事の合計（推定）"
                  >
                    <div>
                      <dt>
                        <FeedingIcon aria-hidden="true" size={18} />
                        食べた量
                        <span className={styles.estimate}>（推定）</span>
                      </dt>
                      <dd>
                        {totalIntakeG}
                        <span>g</span>
                      </dd>
                    </div>
                    <div>
                      <dt>
                        <TbFlame aria-hidden="true" size={18} />
                        カロリー
                        <span className={styles.estimate}>（推定）</span>
                      </dt>
                      <dd>
                        {totalKcal.toFixed(1)}
                        <span>kcal</span>
                      </dd>
                    </div>
                  </dl>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
