"use client";

import { TbPlus } from "react-icons/tb";
import { Button, FormField } from "@/components/ui";
import { useSubmitActionState } from "@/features/navigation/useSubmitActionState";
import type { CreateHouseholdFormState } from "./actions";
import styles from "./HouseholdNameForm.module.css";

type HouseholdCreateFormProps = {
  action: (
    state: CreateHouseholdFormState,
    formData: FormData,
  ) => Promise<CreateHouseholdFormState>;
};

const initialState: CreateHouseholdFormState = {};

/** 家を作成するフォーム。作成したユーザーがその家のオーナーになる */
export function HouseholdCreateForm({ action }: HouseholdCreateFormProps) {
  const [state, formAction, isPending] = useSubmitActionState(
    action,
    initialState,
  );

  return (
    <form action={formAction} className={styles.form}>
      <FormField
        name="name"
        label="家の名前"
        placeholder="わが家"
        description="あとから家の設定で変えられます"
        errorMessage={state.fieldErrors?.name?.[0]}
        isRequired
      />
      <div className={styles.footer}>
        <Button
          type="submit"
          variant="primary"
          leftIcon={TbPlus}
          isDisabled={isPending}
        >
          {isPending ? "作成中..." : "家を作成する"}
        </Button>
      </div>
    </form>
  );
}
