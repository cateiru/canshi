import { TbCalendar, TbPencil } from "react-icons/tb";
import { Badge, ButtonLink } from "@/components/ui";
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
                <p className={styles.date}>
                  <TbCalendar aria-hidden="true" size={16} />
                  <time dateTime={splitDateTimeUtc(expense.spentAt).date}>
                    {splitDateTimeUtc(expense.spentAt).date}
                  </time>
                </p>
                <div className={styles.cardActions}>
                  <ButtonLink
                    href={`/cats/${catId}/expenses/${expense.id}/edit`}
                    variant="secondary"
                    className={styles.iconButton}
                    aria-label={`${EXPENSE_CATEGORY_LABEL[expense.category]} ${formatYen(expense.amountYen)}の支出を編集する`}
                    title="編集する"
                  >
                    <TbPencil aria-hidden="true" size={20} />
                  </ButtonLink>
                  <DeleteRecordButton
                    action={deleteExpenseAction.bind(null, catId, expense.id)}
                    title="支出記録の削除"
                    description="この支出記録を削除しますか？関連するすべての猫の一覧・タイムラインから削除されます。この操作は取り消せません。"
                    iconOnly
                    className={styles.iconButton}
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
            </article>
          </li>
        );
      })}
    </ul>
  );
}
