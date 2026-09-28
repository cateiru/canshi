import { TbCalendar, TbPencil } from "react-icons/tb";
import { Badge, IconButtonLink, RecordCard } from "@/components/ui";
import type { HospitalVisit, MediaAsset } from "@/db/schema";
import { hospitalVisitOptionLabel } from "@/features/hospital-visits/labels";
import { MediaGallery } from "@/features/media/MediaGallery";
import { toMediaAssetView } from "@/features/media/view";
import { DeleteRecordButton } from "@/features/shared/DeleteRecordButton";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import { deleteExpenseAction } from "./actions";
import styles from "./ExpenseList.module.css";
import { EXPENSE_CATEGORY_LABEL, formatYen } from "./labels";
import type { ExpenseWithCats } from "./queries";

type ExpenseListProps = {
  catId: string;
  expenses: ExpenseWithCats[];
  catNameById: Map<string, string>;
  hospitalVisitById: Map<string, HospitalVisit>;
  mediaByRecordId: Map<string, MediaAsset[]>;
};

export function ExpenseList({
  catId,
  expenses,
  catNameById,
  hospitalVisitById,
  mediaByRecordId,
}: ExpenseListProps) {
  return (
    <ul className={styles.list}>
      {expenses.map((expense) => {
        const relatedCatNames = expense.catIds.map(
          (id) => catNameById.get(id) ?? "不明な猫",
        );
        // 複数の猫の通院記録を紐付けられるため、どの猫の通院かも併記する
        const relatedHospitalVisitLabels = expense.hospitalVisitIds.map(
          (id) => {
            const visit = hospitalVisitById.get(id);
            return visit
              ? `${hospitalVisitOptionLabel(visit)}（${catNameById.get(visit.catId) ?? "不明な猫"}）`
              : "不明な通院記録";
          },
        );
        return (
          <li key={expense.id}>
            <RecordCard
              aria-label={`${EXPENSE_CATEGORY_LABEL[expense.category]} ${formatYen(expense.amountYen)}`}
            >
              <div className={styles.recordHeader}>
                <p className={styles.date}>
                  <TbCalendar aria-hidden="true" size={16} />
                  <time dateTime={splitDateTimeUtc(expense.spentAt).date}>
                    {splitDateTimeUtc(expense.spentAt).date}
                  </time>
                </p>
                <div className={styles.cardActions}>
                  <IconButtonLink
                    href={`/cats/${catId}/expenses/${expense.id}/edit`}
                    icon={TbPencil}
                    aria-label={`${EXPENSE_CATEGORY_LABEL[expense.category]} ${formatYen(expense.amountYen)}の支出を編集する`}
                    title="編集する"
                  />
                  <DeleteRecordButton
                    action={deleteExpenseAction.bind(null, catId, expense.id)}
                    title="支出記録の削除"
                    description="この支出記録を削除しますか？関連するすべての猫の一覧・タイムラインから削除されます。この操作は取り消せません。"
                    iconOnly
                  />
                </div>
              </div>

              <div className={styles.amountRow}>
                <Badge color="accent">
                  {EXPENSE_CATEGORY_LABEL[expense.category]}
                </Badge>
                <h2 className={styles.amount}>
                  {formatYen(expense.amountYen)}
                </h2>
              </div>

              <dl className={styles.details}>
                <div>
                  <dt>関連する猫</dt>
                  <dd>
                    {relatedCatNames.length > 0
                      ? relatedCatNames.join("、")
                      : "なし（共通の支出）"}
                  </dd>
                </div>
                {relatedHospitalVisitLabels.length > 0 ? (
                  <div>
                    <dt>関連する通院記録</dt>
                    <dd>{relatedHospitalVisitLabels.join("、")}</dd>
                  </div>
                ) : null}
                {expense.memo ? (
                  <div>
                    <dt>メモ</dt>
                    <dd className={styles.memo}>{expense.memo}</dd>
                  </div>
                ) : null}
              </dl>

              {(mediaByRecordId.get(expense.id)?.length ?? 0) > 0 ? (
                <div className={styles.media}>
                  <MediaGallery
                    assets={(mediaByRecordId.get(expense.id) ?? []).map(
                      toMediaAssetView,
                    )}
                    title="レシートなどの写真"
                    fit="actual"
                  />
                </div>
              ) : null}
            </RecordCard>
          </li>
        );
      })}
    </ul>
  );
}
