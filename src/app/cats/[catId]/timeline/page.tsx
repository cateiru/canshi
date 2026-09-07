import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Card, Checkbox } from "@/components/ui";
import { getCatById } from "@/features/cats/queries";
import { TIMELINE_TYPE_LABEL } from "@/features/timeline/labels";
import {
  listTimelineEntries,
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

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function buildTimelineHref(
  catId: string,
  selectedTypes: TimelineRecordType[],
  page: number,
): string {
  const params = new URLSearchParams();
  for (const type of selectedTypes) {
    params.append("types", type);
  }
  params.set("page", String(page));
  return `/cats/${catId}/timeline?${params.toString()}`;
}

type TimelinePageProps = {
  params: Promise<{ catId: string }>;
  searchParams: Promise<{ types?: string | string[]; page?: string }>;
};

export default async function TimelinePage({
  params,
  searchParams,
}: TimelinePageProps) {
  const { catId } = await params;
  const { types: typesParam, page: pageParam } = await searchParams;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  const hasTypesParam = typesParam != null;
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
