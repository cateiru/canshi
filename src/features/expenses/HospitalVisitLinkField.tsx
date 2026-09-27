"use client";

import { useEffect, useId, useState } from "react";
import { Checkbox } from "@/components/ui";
import type { LinkableHospitalVisit } from "@/features/hospital-visits/queries";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import { listLinkableHospitalVisitsAction } from "./actions";
import styles from "./ExpenseForm.module.css";

export type LinkableHospitalVisitsOnDate = {
  date: string;
  visits: LinkableHospitalVisit[];
};

/**
 * 支出日と同じ日の通院記録（紐付けの候補）を取得する。編集中の支出記録にすでに
 * 紐付いている通院記録も含める。`enabled` が false の間（カテゴリが「病院」以外）は取得しない。
 * 取得中は `visits` が null になる
 */
export function useLinkableHospitalVisits(
  date: string,
  enabled: boolean,
  expenseId: string | undefined,
  initial?: LinkableHospitalVisitsOnDate,
): LinkableHospitalVisit[] | null {
  const [loaded, setLoaded] = useState<LinkableHospitalVisitsOnDate | null>(
    initial ?? null,
  );

  useEffect(() => {
    if (!enabled || loaded?.date === date) {
      return;
    }
    // 日付を続けて変えたときに、古い日付の結果で上書きしないようにする
    let ignore = false;
    listLinkableHospitalVisitsAction(date, expenseId).then(
      (visits) => {
        if (!ignore) setLoaded({ date, visits });
      },
      () => {
        if (!ignore) setLoaded({ date, visits: [] });
      },
    );
    return () => {
      ignore = true;
    };
  }, [date, enabled, expenseId, loaded?.date]);

  return loaded?.date === date ? loaded.visits : null;
}

type HospitalVisitLinkFieldProps = {
  /** 編集中の支出記録の ID。この支出に紐付いている通院記録は選択できる */
  expenseId?: string;
  /** 支出日（`YYYY-MM-DD`）。受診日が違う通院記録は日付も表示する */
  spentDate: string;
  /** 支出日と同じ日の通院記録。取得中は null */
  visits: LinkableHospitalVisit[] | null;
  selectedIds: ReadonlySet<string>;
  onChange: (visit: LinkableHospitalVisit, isSelected: boolean) => void;
  isDisabled: boolean;
  errorMessage?: string;
};

/** カテゴリ「病院」の支出記録に、同じ日の通院記録（複数の猫の分も含む）を紐付ける欄 */
export function HospitalVisitLinkField({
  expenseId,
  spentDate,
  visits,
  selectedIds,
  onChange,
  isDisabled,
  errorMessage,
}: HospitalVisitLinkFieldProps) {
  const hintId = useId();
  const errorId = useId();

  return (
    <fieldset
      className={styles.cats}
      disabled={isDisabled}
      aria-describedby={[hintId, errorMessage ? errorId : null]
        .filter(Boolean)
        .join(" ")}
      aria-invalid={!!errorMessage}
      aria-busy={visits == null}
    >
      <legend className={styles.legend}>関連する通院記録</legend>
      {visits == null ? (
        <p className={styles.hint}>通院記録を読み込んでいます...</p>
      ) : visits.length === 0 ? (
        <p className={styles.hint}>支出日に通院記録はありません。</p>
      ) : (
        <div className={styles.visitList}>
          {visits.map((visit) => {
            const linkedToOther =
              visit.expenseRecordId != null &&
              visit.expenseRecordId !== expenseId;
            const visited = splitDateTimeUtc(visit.visitedAt);
            const visitedLabel =
              visited.date === spentDate
                ? visited.time
                : `${visited.date} ${visited.time}`;
            return (
              <Checkbox
                key={visit.id}
                name="hospitalVisitIds"
                value={visit.id}
                isSelected={selectedIds.has(visit.id)}
                isDisabled={linkedToOther}
                onChange={(isSelected) => onChange(visit, isSelected)}
              >
                {visitedLabel} {visit.catName}：{visit.reason}
                {linkedToOther ? "（ほかの支出記録に紐付け済み）" : ""}
              </Checkbox>
            );
          })}
        </div>
      )}
      <p id={hintId} className={styles.hint}>
        支出日と同じ日の通院記録を紐付けられます。一度に複数の猫を診てもらった場合は、まとめて選んでください。選んだ通院記録の猫は関連する猫にも追加され、金額は通院記録の病院代として表示されます。
      </p>
      {errorMessage ? (
        <p id={errorId} className={styles.errorMessage} role="alert">
          {errorMessage}
        </p>
      ) : null}
    </fieldset>
  );
}
