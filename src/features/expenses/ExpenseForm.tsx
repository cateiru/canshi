"use client";

import { useState } from "react";
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
    redirectTo: `/cats/${catId}/expenses`,
  });
  // 毎レンダリングで new Date() を評価すると FormField の defaultValue が
  // 再レンダリングのたびに変化し、ユーザーの入力が上書きされてしまうため、
  // マウント時に一度だけ計算して固定する
  const [now] = useState(() => new Date());
  const defaultSpentDate = expense
    ? splitDateTimeUtc(expense.spentAt).date
    : getLocalNowParts(now).date;
  // 新規作成では、導線になっている猫を既定で関連付ける
  const defaultCatIds = new Set(expense ? expense.catIds : [catId]);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.row}>
        <FormField
          name="spentDate"
          label="支出日"
          type="date"
          defaultValue={defaultSpentDate}
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

      <fieldset className={styles.cats}>
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
        <p className={styles.hint}>
          支出はすべての猫で共通です。関連付けた猫のタイムラインと絞り込みに表示されます。
        </p>
        {state.fieldErrors?.catIds?.[0] ? (
          <p className={styles.errorMessage}>{state.fieldErrors.catIds[0]}</p>
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
        <p className={styles.errorMessage}>{state.formError}</p>
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
