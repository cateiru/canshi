import { notFound } from "next/navigation";
import { TbPlus } from "react-icons/tb";
import {
  Breadcrumb,
  ButtonLink,
  FilterTabs,
  MonthNav,
  RecordEmptyState,
} from "@/components/ui";
import { ExpenseIcon } from "@/components/ui/RecordIcons/RecordIcons";
import {
  getAccessibleCat,
  listCurrentUserCats,
  requireUser,
} from "@/features/auth/presentation/session";
import {
  sumExpenseAmounts,
  sumExpenseAmountsByCategory,
} from "@/features/expenses/domain/calculations";
import {
  EXPENSE_CATEGORY_LABEL,
  formatYen,
} from "@/features/expenses/domain/labels";
import { EXPENSE_MEDIA_TYPE } from "@/features/expenses/domain/media";
import {
  listExpenseAmountsForMonthRange,
  listExpensesForMonth,
} from "@/features/expenses/infrastructure/queries";
import {
  buildMonthlyExpenseChart,
  getExpenseChartRange,
} from "@/features/expenses/presentation/chart";
import { ExpenseChart } from "@/features/expenses/presentation/ExpenseChart";
import { ExpenseList } from "@/features/expenses/presentation/ExpenseList";
import {
  buildExpensesHref,
  type ExpenseScope,
  isExpenseScope,
} from "@/features/expenses/presentation/href";
import { listHospitalVisitsByIds } from "@/features/hospital-visits/infrastructure/queries";
import { listMediaAssetsByRecords } from "@/features/media/infrastructure/queries";
import { loadRecordContributors } from "@/features/record-contributors/presentation/load";
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
  const [user, cat] = await Promise.all([
    requireUser(),
    getAccessibleCat(catId),
  ]);

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

  // 支出は家に属するため、表示中の猫の家の支出を表示する
  // （アクセスできる猫は家に所属している。`getCatForUser` 参照）
  const householdId = cat.householdId as string;
  const scopedCatId = scope === "cat" ? catId : undefined;
  const chartRange = getExpenseChartRange({ year, month });
  const [expenses, chartExpenses, allCats] = await Promise.all([
    listExpensesForMonth(householdId, year, month, { catId: scopedCatId }),
    listExpenseAmountsForMonthRange(
      householdId,
      chartRange.from,
      chartRange.to,
      { catId: scopedCatId },
    ),
    listCurrentUserCats(),
  ]);
  const catNameById = new Map(
    allCats
      .filter((entry) => entry.householdId === householdId)
      .map((entry) => [entry.id, entry.name]),
  );
  const expenseIds = expenses.map((expense) => expense.id);
  const [mediaByRecordId, hospitalVisitById, contributorsByRecordId] =
    await Promise.all([
      listMediaAssetsByRecords(EXPENSE_MEDIA_TYPE, expenseIds),
      listHospitalVisitsByIds(
        user.id,
        expenses.flatMap((expense) => expense.hospitalVisitIds),
      ),
      loadRecordContributors("expense", expenseIds),
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
          { label: "ねこ一覧", href: "/cats" },
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
          leftIcon={TbPlus}
        >
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

      <FilterTabs
        aria-label="支出の絞り込み"
        selectedKey={scope}
        items={scopeTabs.map((tab) => ({
          key: tab.scope,
          href: buildExpensesHref(catId, { ym, scope: tab.scope }),
          label: tab.label,
        }))}
      />

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
        <RecordEmptyState
          icon={ExpenseIcon}
          actions={
            <ButtonLink
              href={`/cats/${catId}/expenses/new`}
              variant="primary"
              className={styles.createButton}
            >
              最初の記録をする
            </ButtonLink>
          }
        >
          {year}年{month}月の
          {scope === "cat" ? `${cat.name}に関連する` : ""}
          支出記録がありません。
        </RecordEmptyState>
      ) : (
        <ExpenseList
          catId={catId}
          expenses={expenses}
          catNameById={catNameById}
          hospitalVisitById={hospitalVisitById}
          mediaByRecordId={mediaByRecordId}
          contributorsByRecordId={contributorsByRecordId}
        />
      )}
    </main>
  );
}
