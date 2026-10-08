"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { TbCheck } from "react-icons/tb";
import { Button, FormField, FormRow, Select, Textarea } from "@/components/ui";
import type { HospitalVisit, Symptom } from "@/db/schema";
import { listSameDayHospitalExpensesAction } from "@/features/expenses/actions";
import type { HospitalExpenseCandidate } from "@/features/expenses/queries";
import type { MediaLimits } from "@/features/media/limits";
import { MediaAttachmentField } from "@/features/media/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/useMediaFormAction";
import type { MediaAssetView } from "@/features/media/view";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { HospitalVisitFormState } from "./actions";
import { ExpenseLinkConfirmModal } from "./ExpenseLinkConfirmModal";
import styles from "./HospitalVisitForm.module.css";

type FormAction = (
  state: HospitalVisitFormState,
  formData: FormData,
) => Promise<HospitalVisitFormState>;

type HospitalVisitFormProps = {
  catId: string;
  action: FormAction;
  /**
   * 新規作成でアップロードだけ失敗したときの再送信に使う更新 Action（記録 ID を除いて bind したもの）。
   * 編集フォームでは不要
   */
  updateAction?: (
    recordId: string,
    state: HospitalVisitFormState,
    formData: FormData,
  ) => Promise<HospitalVisitFormState>;
  symptoms: Symptom[];
  hospitalVisit?: HospitalVisit;
  /** 通院記録に紐付く病院代（支出記録）の金額。未登録なら null */
  expenseAmountYen?: number | null;
  /** 病院代の支出記録を、ほかの猫などの通院記録と共有しているか */
  isExpenseShared?: boolean;
  mediaAssets?: MediaAssetView[];
  mediaLimits: MediaLimits;
  submitLabel: string;
};

const initialState: HospitalVisitFormState = {};

export function HospitalVisitForm({
  catId,
  action,
  updateAction,
  symptoms,
  hospitalVisit,
  expenseAmountYen,
  isExpenseShared = false,
  mediaAssets,
  mediaLimits,
  submitLabel,
}: HospitalVisitFormProps) {
  const media = useMediaAttachments({
    initial: mediaAssets,
    limits: mediaLimits,
  });
  const isNew = hospitalVisit == null;
  const formRef = useRef<HTMLFormElement>(null);
  // 同じ日の「病院」の支出記録と紐付けるかの回答。作成前に受診日を変えたら聞き直す
  const expenseLinkAnswerRef = useRef<{
    visitedDate: string;
    expenseRecordId: string | null;
  } | null>(null);
  const [expenseCandidates, setExpenseCandidates] = useState<{
    visitedDate: string;
    candidates: HospitalExpenseCandidate[];
  } | null>(null);
  const [isCheckingExpenses, setIsCheckingExpenses] = useState(false);
  const [state, runFormAction, isPending] = useMediaFormAction({
    action,
    updateAction: updateAction
      ? (recordId) => updateAction.bind(null, recordId)
      : undefined,
    initialState,
    media,
    redirectTo: `/cats/${catId}/hospital-visits`,
  });
  // 通院記録を作成済みか（添付の保存だけ失敗して再送信を待っている状態）。
  // 再送信で入力エラーになると `state.savedRecordId` は消えるため、別に覚えておく
  const isSavedRef = useRef(false);
  useEffect(() => {
    if (state.savedRecordId) isSavedRef.current = true;
  }, [state.savedRecordId]);

  const formAction = (formData: FormData) => {
    const answer = expenseLinkAnswerRef.current;
    formData.delete("linkExpenseRecordId");
    // 作成済みなら、受診日を変えていても紐付けた支出記録を送り続ける。
    // 送らないと、病院代が空欄のため紐付けた支出記録が削除されてしまう
    if (
      answer?.expenseRecordId != null &&
      (isSavedRef.current || answer.visitedDate === formData.get("visitedDate"))
    ) {
      formData.set("linkExpenseRecordId", answer.expenseRecordId);
    }
    runFormAction(formData);
  };

  const submitWithAnswer = (
    visitedDate: string,
    expenseRecordId: string | null,
  ) => {
    expenseLinkAnswerRef.current = { visitedDate, expenseRecordId };
    setExpenseCandidates(null);
    formRef.current?.requestSubmit();
  };

  // 新規作成で病院代を入力していないとき、同じ日に「病院」の支出記録があれば
  // 送信を止めて、その支出記録と紐付けるかをモーダルで確認する。作成済みの再送信では聞き直さない
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!isNew || isSavedRef.current) return;
    const formData = new FormData(event.currentTarget);
    const visitedDate = String(formData.get("visitedDate") ?? "");
    const amount = String(formData.get("expenseAmountYen") ?? "").trim();
    if (
      amount !== "" ||
      visitedDate === "" ||
      expenseLinkAnswerRef.current?.visitedDate === visitedDate
    ) {
      return;
    }
    event.preventDefault();
    setIsCheckingExpenses(true);
    listSameDayHospitalExpensesAction(catId, visitedDate)
      .catch(() => [])
      .then((candidates) => {
        setIsCheckingExpenses(false);
        if (candidates.length === 0) {
          submitWithAnswer(visitedDate, null);
        } else {
          setExpenseCandidates({ visitedDate, candidates });
        }
      });
  };
  // 毎レンダリングで new Date() を評価すると FormField の defaultValue が
  // 再レンダリングのたびに変化し、ユーザーの入力が上書きされてしまうため、
  // マウント時に一度だけ計算して固定する
  const [now] = useState(() => new Date());
  const { date: defaultVisitedDate, time: defaultVisitedTime } =
    hospitalVisit?.visitedAt
      ? splitDateTimeUtc(hospitalVisit.visitedAt)
      : getLocalNowParts(now);
  const defaultNextVisit = hospitalVisit?.nextVisitAt
    ? splitDateTimeUtc(hospitalVisit.nextVisitAt)
    : undefined;

  const symptomOptions = [
    { value: "", label: "関連付けない" },
    ...symptoms.map((symptom) => ({
      value: symptom.id,
      label: symptom.symptomType,
    })),
  ];

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className={styles.form}
    >
      <FormRow>
        <FormField
          name="visitedDate"
          label="受診日"
          type="date"
          defaultValue={defaultVisitedDate}
          errorMessage={state.fieldErrors?.visitedDate?.[0]}
          isRequired
        />
        <FormField
          name="visitedTime"
          label="受診時刻"
          type="time"
          defaultValue={defaultVisitedTime}
          errorMessage={state.fieldErrors?.visitedTime?.[0]}
          isRequired
        />
      </FormRow>

      <FormField
        name="reason"
        label="受診理由"
        defaultValue={hospitalVisit?.reason}
        errorMessage={state.fieldErrors?.reason?.[0]}
        isRequired
      />

      <FormField
        name="expenseAmountYen"
        label="病院代（円）"
        type="number"
        inputMode="numeric"
        defaultValue={expenseAmountYen?.toString() ?? ""}
        errorMessage={state.fieldErrors?.expenseAmountYen?.[0]}
        description={
          isExpenseShared
            ? "ほかの通院記録と共有している支出記録です。金額を変えると共有している通院記録の病院代も変わります。空にすると、この通院記録との紐付けだけを外します。"
            : isNew
              ? "入力するとカテゴリ「病院」の支出記録として保存されます。空欄のまま記録すると、同じ日の「病院」の支出記録と紐付けるかを確認します。"
              : "入力するとカテゴリ「病院」の支出記録として保存されます。空にすると支出記録も削除されます。"
        }
      />

      <Select
        className={styles.select}
        name="symptomId"
        label="関連する症状"
        options={symptomOptions}
        defaultSelectedKey={hospitalVisit?.symptomId ?? ""}
        errorMessage={state.fieldErrors?.symptomId?.[0]}
      />

      <Textarea
        name="diagnosis"
        label="診断・所見"
        rows={3}
        defaultValue={hospitalVisit?.diagnosis ?? ""}
        errorMessage={state.fieldErrors?.diagnosis?.[0]}
      />

      <Textarea
        name="examinationResults"
        label="検査と結果"
        rows={3}
        defaultValue={hospitalVisit?.examinationResults ?? ""}
        errorMessage={state.fieldErrors?.examinationResults?.[0]}
      />

      <Textarea
        name="treatment"
        label="注射・処置"
        rows={3}
        defaultValue={hospitalVisit?.treatment ?? ""}
        errorMessage={state.fieldErrors?.treatment?.[0]}
      />

      <FormRow>
        <FormField
          name="nextVisitDate"
          label="次回受診予定日"
          type="date"
          defaultValue={defaultNextVisit?.date ?? ""}
          errorMessage={state.fieldErrors?.nextVisitDate?.[0]}
        />
        <FormField
          name="nextVisitTime"
          label="次回受診予定時刻"
          type="time"
          defaultValue={defaultNextVisit?.time ?? ""}
          errorMessage={state.fieldErrors?.nextVisitTime?.[0]}
        />
      </FormRow>

      <MediaAttachmentField
        controller={media}
        label="診療明細などの写真"
        isDisabled={isPending}
      />

      <Textarea
        name="memo"
        label="備考"
        rows={3}
        defaultValue={hospitalVisit?.memo ?? ""}
        errorMessage={state.fieldErrors?.memo?.[0]}
      />

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        isDisabled={isPending || isCheckingExpenses}
        leftIcon={TbCheck}
      >
        {isPending || isCheckingExpenses ? "保存中..." : submitLabel}
      </Button>

      <ExpenseLinkConfirmModal
        candidates={expenseCandidates?.candidates ?? null}
        onLink={(expenseRecordId) => {
          if (expenseCandidates) {
            submitWithAnswer(expenseCandidates.visitedDate, expenseRecordId);
          }
        }}
        onSkip={() => {
          if (expenseCandidates) {
            submitWithAnswer(expenseCandidates.visitedDate, null);
          }
        }}
        onCancel={() => setExpenseCandidates(null)}
      />
    </form>
  );
}
