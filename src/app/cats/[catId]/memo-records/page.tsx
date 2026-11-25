import { MemoIcon } from "@canshi/shared/ui/RecordIcons";
import { ScaledIcon } from "@canshi/shared/ui/ScaledIcon";
import { notFound } from "next/navigation";
import { TbClock, TbClockOff, TbPencil, TbPlus } from "react-icons/tb";
import {
  Breadcrumb,
  ButtonLink,
  FilterTabs,
  IconButtonLink,
  Pagination,
  RecordCard,
  RecordEmptyState,
} from "@/components/ui";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { isMemorialCat } from "@/features/cats/domain/memorial";
import { catPageMetadata } from "@/features/cats/presentation/catPageMetadata";
import { toMediaAssetView } from "@/features/media/domain/view";
import { listMediaAssetsByRecords } from "@/features/media/infrastructure/queries";
import { MediaGallery } from "@/features/media/presentation/MediaGallery";
import { MEMO_RECORD_MEDIA_TYPE } from "@/features/memo-records/domain/media";
import {
  listMemoLabels,
  listMemoLabelsByRecordIds,
  listMemoLabelsUsedByCat,
} from "@/features/memo-records/infrastructure/labelQueries";
import { listMemoRecords } from "@/features/memo-records/infrastructure/queries";
import { deleteMemoRecordAction } from "@/features/memo-records/presentation/actions";
import { MemoLabelList } from "@/features/memo-records/presentation/MemoLabelChip";
import { memoRecordsHref } from "@/features/memo-records/presentation/paths";
import { loadRecordContributors } from "@/features/record-contributors/presentation/load";
import { RecordContributors } from "@/features/record-contributors/presentation/RecordContributors";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { formatDateTimeUtc } from "@/features/shared/datetime";
import { paginate, parsePageParam } from "@/features/shared/pagination";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const generateMetadata = catPageMetadata(
  (catName) => `${catName}のメモ`,
);

/** 絞り込まないときの、絞り込みの選択肢のキー */
const ALL_LABELS_KEY = "all";

type MemoRecordsPageProps = {
  params: Promise<{ catId: string }>;
  searchParams: Promise<{
    page?: string | string[];
    /** 絞り込むラベルの ID */
    label?: string | string[];
  }>;
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
  // メモリーへ移した猫は、記録を見返すだけにする（追加・編集・削除の導線を出さない）
  const readOnly = isMemorialCat(cat);

  // アクセスできる猫は家に所属している（`getCatForUser` 参照）
  const householdId = cat.householdId as string;
  const { page: pageParam, label: labelParam } = await searchParams;
  const [householdLabels, usedLabels] = await Promise.all([
    listMemoLabels(householdId),
    listMemoLabelsUsedByCat(catId),
  ]);
  // 削除されたラベルや別の家のラベルが指定されたときは絞り込まない
  const filterLabel = householdLabels.find((label) => label.id === labelParam);
  // 絞り込みの選択肢は、このねこのメモに付いているラベルだけにする。絞り込み中のラベルは、
  // 付いたメモがなくなっても選択肢に残す
  const usedLabelIds = new Set(usedLabels.map((label) => label.id));
  const filterLabels = householdLabels.filter(
    (label) => usedLabelIds.has(label.id) || label.id === filterLabel?.id,
  );
  const records = await listMemoRecords(catId, { labelId: filterLabel?.id });
  const {
    items: pagedRecords,
    page,
    totalPages,
  } = paginate(records, parsePageParam(pageParam));
  const recordIds = pagedRecords.map((record) => record.id);
  const [contributorsByRecordId, mediaByRecordId, labelsByRecordId] =
    await Promise.all([
      loadRecordContributors("memo_record", recordIds),
      listMediaAssetsByRecords(MEMO_RECORD_MEDIA_TYPE, recordIds),
      listMemoLabelsByRecordIds(recordIds),
    ]);

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "ねこ一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "メモ" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={MemoIcon}>{cat.name}のメモ</RecordPageHeading>
        {readOnly ? null : (
          <ButtonLink
            href={`/cats/${catId}/memo-records/new`}
            variant="primary"
            className={styles.createButton}
            leftIcon={TbPlus}
          >
            記録する
          </ButtonLink>
        )}
      </div>

      {filterLabels.length > 0 ? (
        <FilterTabs
          aria-label="ラベルでの絞り込み"
          selectedKey={filterLabel?.id ?? ALL_LABELS_KEY}
          items={[
            {
              key: ALL_LABELS_KEY,
              href: memoRecordsHref(catId),
              label: "すべて",
            },
            ...filterLabels.map((label) => ({
              key: label.id,
              href: memoRecordsHref(catId, { labelId: label.id }),
              label: label.name,
            })),
          ]}
        />
      ) : null}

      {records.length === 0 && filterLabel ? (
        <RecordEmptyState icon={MemoIcon}>
          「{filterLabel.name}」のラベルが付いたメモはありません。
        </RecordEmptyState>
      ) : records.length === 0 ? (
        <RecordEmptyState
          icon={MemoIcon}
          actions={
            readOnly ? undefined : (
              <ButtonLink
                href={`/cats/${catId}/memo-records/new`}
                variant="primary"
                className={styles.createButton}
              >
                最初の記録をする
              </ButtonLink>
            )
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
                        <ScaledIcon
                          icon={TbClock}
                          aria-hidden="true"
                          size={18}
                        />
                        <time dateTime={record.recordedAt.toISOString()}>
                          {formatDateTimeUtc(record.recordedAt)}
                        </time>
                      </>
                    ) : (
                      <span className={styles.undated}>
                        <ScaledIcon
                          icon={TbClockOff}
                          aria-hidden="true"
                          size={18}
                        />
                        日付なし
                      </span>
                    )}
                  </h2>
                  <div className={styles.cardActions}>
                    <RecordContributors
                      contributors={contributorsByRecordId.get(record.id)}
                    />
                    {readOnly ? null : (
                      <>
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
                      </>
                    )}
                  </div>
                </div>

                <MemoLabelList
                  labels={labelsByRecordId.get(record.id) ?? []}
                  getHref={(labelId) => memoRecordsHref(catId, { labelId })}
                  className={styles.labels}
                />

                <p className={styles.content}>{record.content}</p>

                <div className={styles.media}>
                  <MediaGallery
                    assets={(mediaByRecordId.get(record.id) ?? []).map(
                      toMediaAssetView,
                    )}
                    title="メモの画像"
                  />
                </div>
              </RecordCard>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        getHref={(target) =>
          memoRecordsHref(catId, { labelId: filterLabel?.id, page: target })
        }
      />
    </main>
  );
}
