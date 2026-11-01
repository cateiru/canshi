import { notFound } from "next/navigation";
import { TbClock, TbPencil, TbPlus } from "react-icons/tb";
import {
  Breadcrumb,
  ButtonLink,
  IconButtonLink,
  Pagination,
  RecordCard,
  RecordEmptyState,
} from "@/components/ui";
import { BrushingIcon } from "@/components/ui/RecordIcons/RecordIcons";
import type { BrushingRecord } from "@/db/schema";
import { getAccessibleCat } from "@/features/auth/session";
import { deleteBrushingRecordAction } from "@/features/brushing-records/actions";
import { SHED_AMOUNT_LABEL } from "@/features/brushing-records/labels";
import { listBrushingRecords } from "@/features/brushing-records/queries";
import { calculateElapsedDays } from "@/features/shampoo-records/calculations";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import {
  buildPageHref,
  paginate,
  parsePageParam,
} from "@/features/shared/pagination";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type BrushingRecordsPageProps = {
  params: Promise<{ catId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

/** カードに表示する項目。入力されたもの（チェックは付けたもの）だけを並べる */
function buildDetails(record: BrushingRecord) {
  const details: { label: string; value: string }[] = [];
  if (record.durationMinutes != null) {
    details.push({ label: "時間", value: `${record.durationMinutes}分` });
  }
  if (record.shedAmount) {
    details.push({
      label: "抜け毛の量",
      value: SHED_AMOUNT_LABEL[record.shedAmount],
    });
  }
  if (record.hasMats) {
    details.push({ label: "毛玉・もつれ", value: "あり" });
  }
  if (record.hasSkinIssue) {
    details.push({ label: "皮膚の異常", value: "あり" });
  }
  if (record.memo) {
    details.push({ label: "備考", value: record.memo });
  }
  return details;
}

export default async function BrushingRecordsPage({
  params,
  searchParams,
}: BrushingRecordsPageProps) {
  const { catId } = await params;
  const cat = await getAccessibleCat(catId);

  if (!cat) {
    notFound();
  }

  const records = await listBrushingRecords(catId);
  const { page: pageParam } = await searchParams;
  const {
    items: pagedRecords,
    page,
    totalPages,
  } = paginate(records, parsePageParam(pageParam));
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
          { label: "ブラッシング記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={BrushingIcon}>
          {cat.name}のブラッシング記録
        </RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/brushing-records/new`}
          variant="primary"
          className={styles.createButton}
          leftIcon={TbPlus}
        >
          記録する
        </ButtonLink>
      </div>

      {elapsedDays != null ? (
        <p className={styles.elapsed}>
          <BrushingIcon aria-hidden="true" size={20} />
          <span>
            前回のブラッシングから<strong>{elapsedDays}</strong>日経過
          </span>
        </p>
      ) : null}

      {records.length === 0 ? (
        <RecordEmptyState
          icon={BrushingIcon}
          actions={
            <ButtonLink
              href={`/cats/${catId}/brushing-records/new`}
              variant="primary"
              className={styles.createButton}
            >
              最初の記録をする
            </ButtonLink>
          }
        >
          まだブラッシング記録がありません。
        </RecordEmptyState>
      ) : (
        <ul className={styles.list}>
          {pagedRecords.map((record) => {
            const details = buildDetails(record);
            return (
              <li key={record.id}>
                <RecordCard aria-label={formatDateTimeUtc(record.performedAt)}>
                  <div className={styles.recordHeader}>
                    <h2 className={styles.recordDate}>
                      <TbClock aria-hidden="true" size={18} />
                      <time dateTime={record.performedAt.toISOString()}>
                        {formatDateTimeUtc(record.performedAt)}
                      </time>
                    </h2>
                    <div className={styles.cardActions}>
                      <IconButtonLink
                        href={`/cats/${catId}/brushing-records/${record.id}/edit`}
                        icon={TbPencil}
                        aria-label="編集する"
                        title="編集する"
                      />
                      <DeleteRecordButton
                        action={deleteBrushingRecordAction.bind(
                          null,
                          catId,
                          record.id,
                        )}
                        title="ブラッシング記録の削除"
                        description="このブラッシング記録を削除しますか？この操作は取り消せません。"
                        iconOnly
                      />
                    </div>
                  </div>

                  {details.length > 0 ? (
                    <dl className={styles.details}>
                      {details.map(({ label, value }) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </RecordCard>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        getHref={(target) =>
          buildPageHref(`/cats/${catId}/brushing-records`, target)
        }
      />
    </main>
  );
}
