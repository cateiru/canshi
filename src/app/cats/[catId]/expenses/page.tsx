import Link from "next/link";
import { notFound } from "next/navigation";
import { TbClock, TbPencil, TbPlus } from "react-icons/tb";
import { Badge, Breadcrumb, ButtonLink } from "@/components/ui";
import { ExpenseIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById, listCats } from "@/features/cats/queries";
import { deleteExpenseAction } from "@/features/expenses/actions";
import {
  sumExpenseAmounts,
  sumExpenseAmountsByCategory,
} from "@/features/expenses/calculations";
import {
  buildExpensesHref,
  type ExpenseScope,
  isExpenseScope,
} from "@/features/expenses/href";
import { EXPENSE_CATEGORY_LABEL, formatYen } from "@/features/expenses/labels";
import { EXPENSE_MEDIA_TYPE } from "@/features/expenses/media";
import { listExpensesForMonth } from "@/features/expenses/queries";
import { hospitalVisitOptionLabel } from "@/features/hospital-visits/labels";
import { listHospitalVisitsByIds } from "@/features/hospital-visits/queries";
import { MediaGallery } from "@/features/media/MediaGallery";
import { listMediaAssetsByRecords } from "@/features/media/queries";
import { toMediaAssetView } from "@/features/media/view";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { getNaiveUtcNow, splitDateTimeUtc } from "@/features/shared/datetime";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import { Surface } from "@/features/shared/Surface";
import { formatYm, parseYm, shiftYm } from "@/features/shared/yearMonth";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type ExpensesPageProps = {
  params: Promise<{ catId: string }>;
  searchParams: Promise<{ ym?: string; scope?: string }>;
};

export default async function ExpensesPage({
  params,
  searchParams,
}: ExpensesPageProps) {
  const { catId } = await params;
  const { ym: ymParam, scope: scopeParam } = await searchParams;
  const cat = await getCatById(catId);

  if (!cat) {
    notFound();
  }

  // 記録の保存値と同じ「naive UTC」の現在時刻を基準にする（datetime.ts 参照）
  const nowDateKey = splitDateTimeUtc(getNaiveUtcNow()).date;
  const { year, month } = parseYm(ymParam, {
    year: Number.parseInt(nowDateKey.slice(0, 4), 10),
    month: Number.parseInt(nowDateKey.slice(5, 7), 10),
  });
  const ym = formatYm({ year, month });
  const scope: ExpenseScope = isExpenseScope(scopeParam) ? scopeParam : "all";

  const [expenses, allCats] = await Promise.all([
    listExpensesForMonth(year, month, {
      catId: scope === "cat" ? catId : undefined,
    }),
    listCats(),
  ]);
  const catNameById = new Map(allCats.map((entry) => [entry.id, entry.name]));
  const [mediaByRecordId, hospitalVisitById] = await Promise.all([
    listMediaAssetsByRecords(
      EXPENSE_MEDIA_TYPE,
      expenses.map((expense) => expense.id),
    ),
    listHospitalVisitsByIds(
      expenses
        .map((expense) => expense.hospitalVisitId)
        .filter((id): id is string => id != null),
    ),
  ]);

  const total = sumExpenseAmounts(expenses);
  const categoryTotals = sumExpenseAmountsByCategory(expenses);

  const scopeTabs: { scope: ExpenseScope; label: string }[] = [
    { scope: "all", label: "すべての支出" },
    { scope: "cat", label: `${cat.name}のみ` },
  ];

  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[
          { label: "トップ", href: "/home" },
          { label: "猫一覧", href: "/cats" },
          { label: cat.name, href: `/cats/${catId}` },
          { label: "支出記録" },
        ]}
      />

      <div className={styles.header}>
        <RecordPageHeading icon={ExpenseIcon}>支出記録</RecordPageHeading>
        <ButtonLink
          href={`/cats/${catId}/expenses/new`}
          variant="primary"
          className={styles.createButton}
        >
          <TbPlus aria-hidden="true" size={18} />
          記録する
        </ButtonLink>
      </div>

      <nav className={styles.monthNav} aria-label="表示する月">
        <Link
          href={buildExpensesHref(catId, {
            ym: formatYm(shiftYm({ year, month }, -1)),
            scope,
          })}
        >
          ← 前の月
        </Link>
        <span className={styles.monthLabel}>
          {year}年{month}月
        </span>
        <Link
          href={buildExpensesHref(catId, {
            ym: formatYm(shiftYm({ year, month }, 1)),
            scope,
          })}
        >
          次の月 →
        </Link>
      </nav>

      <nav className={styles.scopeNav} aria-label="支出の絞り込み">
        {scopeTabs.map((tab) => (
          <Link
            key={tab.scope}
            href={buildExpensesHref(catId, { ym, scope: tab.scope })}
            className={styles.scopeTab}
            data-selected={tab.scope === scope ? "true" : undefined}
            aria-current={tab.scope === scope ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <Surface title={`${year}年${month}月の合計`}>
        <p className={styles.total}>{formatYen(total)}</p>
        {categoryTotals.length > 0 ? (
          <dl className={styles.categoryTotals}>
            {categoryTotals.map((categoryTotal) => (
              <div key={categoryTotal.category}>
                <dt>{EXPENSE_CATEGORY_LABEL[categoryTotal.category]}</dt>
                <dd>{formatYen(categoryTotal.amountYen)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Surface>

      {expenses.length === 0 ? (
        <div className={styles.emptyState}>
          <ExpenseIcon aria-hidden="true" size={32} />
          <p>
            {year}年{month}月の
            {scope === "cat" ? `${cat.name}に関連する` : ""}
            支出記録がありません。
          </p>
          <div className={styles.emptyActions}>
            <ButtonLink
              href={`/cats/${catId}/expenses/new`}
              variant="primary"
              className={styles.createButton}
            >
              最初の記録をする
            </ButtonLink>
          </div>
        </div>
      ) : (
        <ul className={styles.list}>
          {expenses.map((expense) => {
            const relatedCatNames = expense.catIds.map(
              (id) => catNameById.get(id) ?? "不明な猫",
            );
            const relatedHospitalVisit =
              expense.hospitalVisitId != null
                ? hospitalVisitById.get(expense.hospitalVisitId)
                : undefined;
            return (
              <li key={expense.id}>
                <article
                  className={styles.record}
                  aria-label={`${EXPENSE_CATEGORY_LABEL[expense.category]} ${formatYen(expense.amountYen)}`}
                >
                  <div className={styles.recordHeader}>
                    <h2 className={styles.recordTitle}>
                      {formatYen(expense.amountYen)}
                    </h2>
                    <div className={styles.cardActions}>
                      <Badge color="accent">
                        {EXPENSE_CATEGORY_LABEL[expense.category]}
                      </Badge>
                      <ButtonLink
                        href={`/cats/${catId}/expenses/${expense.id}/edit`}
                        variant="secondary"
                        className={styles.iconButton}
                        aria-label="編集する"
                        title="編集する"
                      >
                        <TbPencil aria-hidden="true" size={20} />
                      </ButtonLink>
                      <DeleteRecordButton
                        action={deleteExpenseAction.bind(
                          null,
                          catId,
                          expense.id,
                        )}
                        title="支出記録の削除"
                        description="この支出記録を削除しますか？この操作は取り消せません。"
                        iconOnly
                        className={styles.iconButton}
                      />
                    </div>
                  </div>

                  <p className={styles.meta}>
                    <TbClock aria-hidden="true" size={16} />
                    <time dateTime={expense.spentAt.toISOString()}>
                      {splitDateTimeUtc(expense.spentAt).date}
                    </time>
                  </p>

                  <dl className={styles.details}>
                    <div>
                      <dt>関連する猫</dt>
                      <dd>
                        {relatedCatNames.length > 0
                          ? relatedCatNames.join("、")
                          : "なし（共通の支出）"}
                      </dd>
                    </div>
                    {expense.hospitalVisitId ? (
                      <div>
                        <dt>関連する通院記録</dt>
                        <dd>
                          {relatedHospitalVisit
                            ? hospitalVisitOptionLabel(relatedHospitalVisit)
                            : "不明な通院記録"}
                        </dd>
                      </div>
                    ) : null}
                    {expense.memo ? (
                      <div>
                        <dt>メモ</dt>
                        <dd>{expense.memo}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className={styles.media}>
                    <MediaGallery
                      assets={(mediaByRecordId.get(expense.id) ?? []).map(
                        toMediaAssetView,
                      )}
                      title="レシートなどの写真"
                      fit="actual"
                    />
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
