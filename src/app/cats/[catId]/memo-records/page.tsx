import { notFound } from "next/navigation";
import { TbClock, TbClockOff, TbPencil, TbPlus } from "react-icons/tb";
import {
  Breadcrumb,
  ButtonLink,
  IconButtonLink,
  Pagination,
  RecordCard,
  RecordEmptyState,
} from "@/components/ui";
import { MemoIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getAccessibleCat } from "@/features/auth/session";
import { deleteMemoRecordAction } from "@/features/memo-records/actions";
import { listMemoRecords } from "@/features/memo-records/queries";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import {
  buildPageHref,
  paginate,
  parsePageParam,
} from "@/features/shared/pagination";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type MemoRecordsPageProps = {
  params: Promise<{ catId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export default async function MemoRecordsPage({
  params,
  searchParams,
}: MemoRecordsPageProps) {
  const { catId } = await params;
  const cat = await getAccessibleCat(catId);

  if (!cat) {
    notFound();
  }

  const records = await listMemoRecords(catId);
  const { page: pageParam } = await searchParams;
  const {
    items: pagedRecords,
    page,
    totalPages,
  } = paginate(records, parsePageParam(pageParam));

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "メモ" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={MemoIcon}>{cat.name}のメモ</RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/memo-records/new`}
          variant="primary"
          className={styles.createButton}
          leftIcon={TbPlus}
        >
          記録する
        </ButtonLink>
      </div>

      {records.length === 0 ? (
        <RecordEmptyState
          icon={MemoIcon}
          actions={
            <ButtonLink
              href={`/cats/${catId}/memo-records/new`}
              variant="primary"
              className={styles.createButton}
            >
              最初の記録をする
            </ButtonLink>
          }
        >
          まだメモがありません。
        </RecordEmptyState>
      ) : (
        <ul className={styles.list}>
          {pagedRecords.map((record) => (
            <li key={record.id}>
              <RecordCard
                aria-label={
                  record.recordedAt
                    ? formatDateTimeUtc(record.recordedAt)
                    : "日付なし"
                }
              >
                <div className={styles.recordHeader}>
                  <h2 className={styles.recordDate}>
                    {record.recordedAt ? (
                      <>
                        <TbClock aria-hidden="true" size={18} />
                        <time dateTime={record.recordedAt.toISOString()}>
                          {formatDateTimeUtc(record.recordedAt)}
                        </time>
                      </>
                    ) : (
                      <span className={styles.undated}>
                        <TbClockOff aria-hidden="true" size={18} />
                        日付なし
                      </span>
                    )}
                  </h2>
                  <div className={styles.cardActions}>
                    <IconButtonLink
                      href={`/cats/${catId}/memo-records/${record.id}/edit`}
                      icon={TbPencil}
                      aria-label="編集する"
                      title="編集する"
                    />
                    <DeleteRecordButton
                      action={deleteMemoRecordAction.bind(
                        null,
                        catId,
                        record.id,
                      )}
                      title="メモの削除"
                      description="このメモを削除しますか？この操作は取り消せません。"
                      iconOnly
                    />
                  </div>
                </div>

                <p className={styles.content}>{record.content}</p>
              </RecordCard>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        getHref={(target) =>
          buildPageHref(`/cats/${catId}/memo-records`, target)
        }
      />
    </main>
  );
}
