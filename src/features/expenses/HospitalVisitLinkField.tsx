"use client";

import { useEffect, useState } from "react";
import { Button, Checkbox, FormGroup } from "@/components/ui";
import type { LinkableHospitalVisit } from "@/features/hospital-visits/queries";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import { listLinkableHospitalVisitsAction } from "./actions";
import styles from "./ExpenseForm.module.css";

export type LinkableHospitalVisitsOnDate = {
  date: string;
  visits: LinkableHospitalVisit[];
};

/**
 * 紐付けの候補の取得状態。取得に失敗したときは「候補なし」と区別し、
 * 既存の紐付けを外してしまわないよう保存を止めて再取得を促す
 */
export type LinkableHospitalVisitsState =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "loaded"; visits: LinkableHospitalVisit[] };

/**
 * 支出日と同じ日の通院記録（紐付けの候補）を取得する。編集中の支出記録にすでに
 * 紐付いている通院記録も含める。`enabled` が false の間（カテゴリが「病院」以外）は取得しない
 */
export function useLinkableHospitalVisits(
  date: string,
  enabled: boolean,
  expenseId: string | undefined,
  initial?: LinkableHospitalVisitsOnDate,
): LinkableHospitalVisitsState {
  const [loaded, setLoaded] = useState<
    LinkableHospitalVisitsOnDate | { date: string; visits: null } | null
  >(initial ?? null);

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
        if (!ignore) setLoaded({ date, visits: null });
      },
    );
    return () => {
      ignore = true;
    };
  }, [date, enabled, expenseId, loaded?.date]);

  if (loaded?.date !== date) {
    return { status: "loading" };
  }
  if (loaded.visits == null) {
    // 取得結果を捨てると、上の effect がもう一度取得する
    return { status: "error", retry: () => setLoaded(null) };
  }
  return { status: "loaded", visits: loaded.visits };
}

type HospitalVisitLinkFieldProps = {
  /** 編集中の支出記録の ID。この支出に紐付いている通院記録は選択できる */
  expenseId?: string;
  /** 支出日（`YYYY-MM-DD`）。受診日が違う通院記録は日付も表示する */
  spentDate: string;
  /** 支出日と同じ日の通院記録の取得状態 */
  visitsState: LinkableHospitalVisitsState;
  selectedIds: ReadonlySet<string>;
  onChange: (visit: LinkableHospitalVisit, isSelected: boolean) => void;
  isDisabled: boolean;
  errorMessage?: string;
};

/** カテゴリ「病院」の支出記録に、同じ日の通院記録（複数の猫の分も含む）を紐付ける欄 */
export function HospitalVisitLinkField({
  expenseId,
  spentDate,
  visitsState,
  selectedIds,
  onChange,
  isDisabled,
  errorMessage,
}: HospitalVisitLinkFieldProps) {
  return (
    <FormGroup
      legend="関連する通院記録"
      description="支出日と同じ日の通院記録を紐付けられます。一度に複数の猫を診てもらった場合は、まとめて選んでください。選んだ通院記録の猫は関連する猫にも追加され、金額は通院記録の病院代として表示されます。"
      errorMessage={errorMessage}
      isDisabled={isDisabled}
      aria-busy={visitsState.status === "loading"}
    >
      {visitsState.status === "loading" ? (
        <p className={styles.hint}>通院記録を読み込んでいます...</p>
      ) : visitsState.status === "error" ? (
        <div className={styles.loadError}>
          <p className={styles.errorMessage} role="alert">
            通院記録を読み込めませんでした。紐付けが外れないよう、読み込み直してから保存してください。
          </p>
          <Button onPress={visitsState.retry}>読み込み直す</Button>
        </div>
      ) : visitsState.visits.length === 0 ? (
        <p className={styles.hint}>支出日に通院記録はありません。</p>
      ) : (
        <div className={styles.visitList}>
          {visitsState.visits.map((visit) => {
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
    </FormGroup>
  );
}
