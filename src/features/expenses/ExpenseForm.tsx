"use client";

import { useId, useState } from "react";
import { TbCheck } from "react-icons/tb";
import { Button, Checkbox, FormField, Select, Textarea } from "@/components/ui";
import type { Cat, ExpenseCategory } from "@/db/schema";
import { EXPENSE_CATEGORIES } from "@/db/schema";
import type { MediaLimits } from "@/features/media/limits";
import { MediaAttachmentField } from "@/features/media/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/useMediaFormAction";
import type { MediaAssetView } from "@/features/media/view";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { ExpenseFormState } from "./actions";
import styles from "./ExpenseForm.module.css";
import {
  HospitalVisitLinkField,
  type LinkableHospitalVisitsOnDate,
  useLinkableHospitalVisits,
} from "./HospitalVisitLinkField";
import { buildExpensesHref } from "./href";
import { EXPENSE_CATEGORY_LABEL } from "./labels";
import type { ExpenseWithCats } from "./queries";

type FormAction = (
  state: ExpenseFormState,
  formData: FormData,
) => Promise<ExpenseFormState>;

type ExpenseFormProps = {
  /** 送信後の遷移先に使う、導線になっている猫 */
  catId: string;
  action: FormAction;
  /**
   * 新規作成でアップロードだけ失敗したときの再送信に使う更新 Action（記録 ID を除いて bind したもの）。
   * 編集フォームでは不要
   */
  updateAction?: (
    recordId: string,
    state: ExpenseFormState,
    formData: FormData,
  ) => Promise<ExpenseFormState>;
  /** 関連付けの選択肢になるすべての猫 */
  cats: Cat[];
  expense?: ExpenseWithCats;
  /** 編集時に、支出日と同じ日の通院記録をあらかじめ取得したもの（カテゴリが「病院」の場合） */
  initialLinkableHospitalVisits?: LinkableHospitalVisitsOnDate;
  mediaAssets?: MediaAssetView[];
  mediaLimits: MediaLimits;
  submitLabel: string;
};

const initialState: ExpenseFormState = {};

const categoryOptions = EXPENSE_CATEGORIES.map((category) => ({
  value: category,
  label: EXPENSE_CATEGORY_LABEL[category],
}));

export function ExpenseForm({
  catId,
  action,
  updateAction,
  cats,
  expense,
  initialLinkableHospitalVisits,
  mediaAssets,
  mediaLimits,
  submitLabel,
}: ExpenseFormProps) {
  const catHintId = useId();
  const catErrorId = useId();
  const [spentDate, setSpentDate] = useState(() =>
    expense
      ? splitDateTimeUtc(expense.spentAt).date
      : getLocalNowParts(new Date()).date,
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    expense?.category ?? "other",
  );
  const [selectedCatIds, setSelectedCatIds] = useState<ReadonlySet<string>>(
    () => new Set(expense?.catIds ?? [catId]),
  );
  const [selectedHospitalVisitIds, setSelectedHospitalVisitIds] = useState<
    ReadonlySet<string>
  >(() => new Set(expense?.hospitalVisitIds ?? []));
  const isHospital = category === "hospital";
  const linkableHospitalVisits = useLinkableHospitalVisits(
    spentDate,
    isHospital,
    expense?.id,
    initialLinkableHospitalVisits,
  );
  // 候補を読み込み中に保存すると、紐付けが送信されずに外れてしまうため保存を待たせる
  const isLoadingHospitalVisits = isHospital && linkableHospitalVisits == null;
  const media = useMediaAttachments({
    initial: mediaAssets,
    limits: mediaLimits,
  });
  const [state, formAction, isPending] = useMediaFormAction({
    action,
    updateAction: updateAction
      ? (recordId) => updateAction.bind(null, recordId)
      : undefined,
    initialState,
    media,
    redirectTo: buildExpensesHref(catId, {
      ym: spentDate.slice(0, 7),
      scope: "all",
    }),
  });

  const catError = state.fieldErrors?.catIds?.[0];

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.row}>
        <FormField
          name="spentDate"
          label="支出日"
          type="date"
          value={spentDate}
          onChange={setSpentDate}
          errorMessage={state.fieldErrors?.spentDate?.[0]}
          isRequired
        />
        <FormField
          name="amountYen"
          label="金額（円）"
          type="number"
          inputMode="numeric"
          defaultValue={expense?.amountYen?.toString()}
          errorMessage={state.fieldErrors?.amountYen?.[0]}
          isRequired
        />
      </div>

      <Select
        className={styles.select}
        name="category"
        label="カテゴリ"
        options={categoryOptions}
        selectedKey={category}
        onSelectionChange={(key) => setCategory(key as ExpenseCategory)}
        errorMessage={state.fieldErrors?.category?.[0]}
      />

      {isHospital ? (
        <HospitalVisitLinkField
          expenseId={expense?.id}
          spentDate={spentDate}
          visits={linkableHospitalVisits}
          selectedIds={selectedHospitalVisitIds}
          onChange={(visit, isSelected) => {
            setSelectedHospitalVisitIds((current) =>
              toggleInSet(current, visit.id, isSelected),
            );
            // 通院した猫の支出でもあるため、関連する猫にも追加する
            if (isSelected) {
              setSelectedCatIds((current) =>
                toggleInSet(current, visit.catId, true),
              );
            }
          }}
          isDisabled={isPending}
          errorMessage={state.fieldErrors?.hospitalVisitIds?.[0]}
        />
      ) : (expense?.hospitalVisitIds.length ?? 0) > 0 ? (
        <p className={styles.hint}>
          カテゴリを「病院」以外にして保存すると、通院記録との紐付けは解除されます。
        </p>
      ) : null}

      <fieldset
        className={styles.cats}
        disabled={isPending}
        aria-describedby={[catHintId, catError ? catErrorId : null]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={!!catError}
      >
        <legend className={styles.legend}>関連する猫</legend>
        {cats.length === 0 ? (
          <p className={styles.hint}>関連付けられる猫がいません。</p>
        ) : (
          <div className={styles.catList}>
            {cats.map((cat) => (
              <Checkbox
                key={cat.id}
                name="catIds"
                value={cat.id}
                isSelected={selectedCatIds.has(cat.id)}
                onChange={(isSelected) =>
                  setSelectedCatIds((current) =>
                    toggleInSet(current, cat.id, isSelected),
                  )
                }
              >
                {cat.name}
              </Checkbox>
            ))}
          </div>
        )}
        <p id={catHintId} className={styles.hint}>
          複数選択できます。選んだ猫のタイムラインに表示され、どの猫も選ばない場合は共通の支出として保存されます。
        </p>
        {catError ? (
          <p id={catErrorId} className={styles.errorMessage} role="alert">
            {catError}
          </p>
        ) : null}
      </fieldset>

      <MediaAttachmentField
        controller={media}
        label="レシートなどの写真"
        isDisabled={isPending}
      />

      <Textarea
        name="memo"
        label="メモ"
        rows={3}
        defaultValue={expense?.memo ?? ""}
        errorMessage={state.fieldErrors?.memo?.[0]}
      />

      {state.formError ? (
        <p className={styles.errorMessage} role="alert">
          {state.formError}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        className={styles.submitButton}
        isDisabled={isPending || isLoadingHospitalVisits}
      >
        <TbCheck aria-hidden="true" size={18} />
        {isPending ? "保存中..." : submitLabel}
      </Button>
    </form>
  );
}

function toggleInSet(
  current: ReadonlySet<string>,
  value: string,
  include: boolean,
): ReadonlySet<string> {
  if (current.has(value) === include) {
    return current;
  }
  const next = new Set(current);
  if (include) {
    next.add(value);
  } else {
    next.delete(value);
  }
  return next;
}
