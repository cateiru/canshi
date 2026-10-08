"use client";

import { useState } from "react";
import { TbCheck } from "react-icons/tb";
import {
  Button,
  Checkbox,
  FormField,
  FormGroup,
  FormRow,
  Select,
  Textarea,
} from "@/components/ui";
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
  /** 導線になっている猫。送信後の遷移先と、通院記録の候補を探す家に使う */
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
  /** 関連付けの選択肢になる猫（支出の家の猫） */
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
  const linkableHospitalVisitsState = useLinkableHospitalVisits(
    catId,
    spentDate,
    isHospital,
    expense?.id,
    initialLinkableHospitalVisits,
  );
  // 候補を読み込めていない（読み込み中・失敗）ときに保存すると、紐付けが送信されずに
  // 外れてしまうため保存させない
  const isHospitalVisitsUnavailable =
    isHospital && linkableHospitalVisitsState.status !== "loaded";
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
      <FormRow>
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
      </FormRow>

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
          visitsState={linkableHospitalVisitsState}
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

      <FormGroup
        legend="関連する猫"
        description="複数選択できます。選んだ猫のタイムラインに表示され、どの猫も選ばない場合は共通の支出として保存されます。"
        errorMessage={catError}
        isDisabled={isPending}
      >
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
      </FormGroup>

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
        isDisabled={isPending || isHospitalVisitsUnavailable}
        leftIcon={TbCheck}
      >
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
