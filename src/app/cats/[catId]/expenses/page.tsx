import Link from "next/link";
import { notFound } from "next/navigation";
import { TbPlus } from "react-icons/tb";
import { Breadcrumb, ButtonLink } from "@/components/ui";
import { ExpenseIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { getCatById, listCats } from "@/features/cats/queries";
import {
  sumExpenseAmounts,
  sumExpenseAmountsByCategory,
} from "@/features/expenses/calculations";
import {
  buildMonthlyExpenseChart,
  getExpenseChartRange,
} from "@/features/expenses/chart";
import { ExpenseChart } from "@/features/expenses/ExpenseChart";
import { ExpenseList } from "@/features/expenses/ExpenseList";
import {
  buildExpensesHref,
  type ExpenseScope,
  isExpenseScope,
} from "@/features/expenses/href";
import { EXPENSE_CATEGORY_LABEL, formatYen } from "@/features/expenses/labels";
import { EXPENSE_MEDIA_TYPE } from "@/features/expenses/media";
import {
  listExpenseAmountsForMonthRange,
  listExpensesForMonth,
} from "@/features/expenses/queries";
import { listHospitalVisitsByIds } from "@/features/hospital-visits/queries";
import { listMediaAssetsByRecords } from "@/features/media/queries";
import { getNaiveUtcNow, splitDateTimeUtc } from "@/features/shared/datetime";
import { MonthNav } from "@/features/shared/MonthNav";
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

  const scopedCatId = scope === "cat" ? catId : undefined;
  const chartRange = getExpenseChartRange({ year, month });
  const [expenses, chartExpenses, allCats] = await Promise.all([
    listExpensesForMonth(year, month, { catId: scopedCatId }),
    listExpenseAmountsForMonthRange(chartRange.from, chartRange.to, {
      catId: scopedCatId,
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

      <MonthNav
        year={year}
        month={month}
        prevHref={buildExpensesHref(catId, {
          ym: formatYm(shiftYm({ year, month }, -1)),
          scope,
        })}
        nextHref={buildExpensesHref(catId, {
          ym: formatYm(shiftYm({ year, month }, 1)),
          scope,
        })}
      />

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

      <ExpenseChart
        months={buildMonthlyExpenseChart(chartExpenses, { year, month })}
      />

      <Surface title={`${year}年${month}月の合計`}>
        <p className={styles.summaryScope}>
          {scope === "cat" ? `${cat.name}に関連する支出` : "すべての支出"}・
          {expenses.length}件
        </p>
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
        <ExpenseList
          catId={catId}
          expenses={expenses}
          catNameById={catNameById}
          hospitalVisitById={hospitalVisitById}
          mediaByRecordId={mediaByRecordId}
        />
      )}
    </main>
  );
}
