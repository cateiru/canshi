import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Checkbox } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { TIMELINE_TYPE_LABEL } from "@/features/timeline/labels";
import {
  listTimelineEntries,
  MAX_PAGE,
  normalizePositiveInt,
  TIMELINE_RECORD_TYPES,
  type TimelineRecordType,
} from "@/features/timeline/queries";
import { TimelineEntryCard } from "@/features/timeline/TimelineEntryCard";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function isTimelineRecordType(value: string): value is TimelineRecordType {
  return (TIMELINE_RECORD_TYPES as readonly string[]).includes(value);
}

// listTimelineEntries 内部で使われるのと同じクランプ処理を通すことで、
// ページネーションリンクが実際にクエリされたページ番号とずれないようにする
function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return normalizePositiveInt(parsed, MAX_PAGE);
}

function buildTimelineHref(
  catId: string,
  selectedTypes: TimelineRecordType[],
  page: number,
): string {
  const params = new URLSearchParams();
  // 「絞り込みを実行した」ことを明示するマーカー。types が0件でも
  // 必ず付与することで、ページ遷移時に「全チェックを外して絞り込んだ」状態と
  // 「一度も絞り込んでいない」状態（＝全件表示）を区別できるようにする
  params.set("filtered", "1");
  for (const type of selectedTypes) {
    params.append("types", type);
  }
  params.set("page", String(page));
  return `/cats/${catId}/timeline?${params.toString()}`;
}

type TimelinePageProps = {
  params: Promise<{ catId: string }>;
  searchParams: Promise<{
    types?: string | string[];
    page?: string;
    filtered?: string;
  }>;
};

export default async function TimelinePage({
  params,
  searchParams,
}: TimelinePageProps) {
  const { catId } = await params;
  const {
    types: typesParam,
    page: pageParam,
    filtered: filteredParam,
  } = await searchParams;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  // types パラメータの有無ではなく、絞り込みフォームが送信されたかどうかを
  // 示す明示的なマーカーで判定する。ネイティブの GET フォーム送信では
  // 未選択のチェックボックスがそもそも送られないため、「全チェックを外して
  // 送信した」場合と「一度も絞り込んでいない」場合の両方で types パラメータが
  // 欠落してしまい、types の有無だけでは区別できない
  const hasTypesParam = filteredParam != null;
  const rawTypes =
    typesParam == null ? [] : ([] as string[]).concat(typesParam);
  const selectedTypes = hasTypesParam
    ? [...new Set(rawTypes.filter(isTimelineRecordType))]
    : [...TIMELINE_RECORD_TYPES];
  const page = parsePage(pageParam);

  const { entries, hasMore } = await listTimelineEntries(catId, {
    types: selectedTypes,
    page,
    pageSize: PAGE_SIZE,
  });

  const prevHref = buildTimelineHref(catId, selectedTypes, page - 1);
  const nextHref = buildTimelineHref(catId, selectedTypes, page + 1);

  return (
    <main className={styles.main}>
      <Link href={`/cats/${catId}`} className={styles.backLink}>
        ← {cat.name}のページに戻る
      </Link>

      <h1>{cat.name}のタイムライン</h1>

      <Card title="絞り込み">
        <form action={`/cats/${catId}/timeline`} className={styles.filterForm}>
          <input type="hidden" name="filtered" value="1" />
          <div className={styles.filterOptions}>
            {TIMELINE_RECORD_TYPES.map((type) => (
              <Checkbox
                key={type}
                name="types"
                value={type}
                defaultSelected={selectedTypes.includes(type)}
              >
                {TIMELINE_TYPE_LABEL[type]}
              </Checkbox>
            ))}
          </div>
          <Button type="submit" variant="primary">
            絞り込む
          </Button>
        </form>
      </Card>

      {entries.length === 0 ? (
        <Card>
          <p>表示できる記録がありません。</p>
        </Card>
      ) : (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <li key={`${entry.type}-${entry.id}`}>
              <TimelineEntryCard catId={catId} entry={entry} />
            </li>
          ))}
        </ul>
      )}

      <div className={styles.pagination}>
        {page > 1 ? <Link href={prevHref}>← 前のページ</Link> : <span />}
        {hasMore ? <Link href={nextHref}>次のページ →</Link> : <span />}
      </div>
    </main>
  );
}
