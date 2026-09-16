"use client";

import { useId, useState } from "react";
import { TbCheck } from "react-icons/tb";
import { Button, Checkbox, FormField, Select, Textarea } from "@/components/ui";
import type { Cat } from "@/db/schema";
import { EXPENSE_CATEGORIES } from "@/db/schema";
import type { MediaLimits } from "@/features/media/limits";
import { MediaAttachmentField } from "@/features/media/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/useMediaFormAction";
import type { MediaAssetView } from "@/features/media/view";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { ExpenseFormState } from "./actions";
import styles from "./ExpenseForm.module.css";
import { buildExpensesHref } from "./href";
import { EXPENSE_CATEGORY_LABEL } from "./labels";
import { EXPENSE_MEDIA_TYPE } from "./media";
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
  const [defaultCatIds] = useState(() => new Set(expense?.catIds ?? [catId]));
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
    recordType: EXPENSE_MEDIA_TYPE,
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
        defaultSelectedKey={expense?.category ?? "other"}
        errorMessage={state.fieldErrors?.category?.[0]}
      />

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
                defaultSelected={defaultCatIds.has(cat.id)}
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

      {expense?.hospitalVisitId ? (
        <p className={styles.hint}>
          通院記録と連携している支出です。金額は通院記録の病院代にも反映されます。通院記録を更新すると、支出日は受診日に合わせて更新されます。
        </p>
      ) : null}

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
        isDisabled={isPending}
      >
        <TbCheck aria-hidden="true" size={18} />
        {isPending ? "保存中..." : submitLabel}
      </Button>
    </form>
  );
}
