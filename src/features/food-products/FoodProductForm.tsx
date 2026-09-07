"use client";

import { useActionState } from "react";
import { Button, FormField, Select } from "@/components/ui";
import type { FoodProduct } from "@/db/schema";
import type { FoodProductFormState } from "./actions";
import styles from "./FoodProductForm.module.css";

type FoodProductFormProps = {
  action: (
    state: FoodProductFormState,
    formData: FormData,
  ) => Promise<FoodProductFormState>;
  foodProduct?: FoodProduct;
  submitLabel: string;
};

const initialState: FoodProductFormState = {};

const NUTRITION_TYPE_OPTIONS = [
  { value: "complete", label: "総合栄養食" },
  { value: "general", label: "一般食" },
];

const TEXTURE_TYPE_OPTIONS = [
  { value: "dry", label: "ドライ" },
  { value: "wet", label: "ウェット" },
];

export function FoodProductForm({
  action,
  foodProduct,
  submitLabel,
}: FoodProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <FormField
        name="name"
        label="商品名"
        defaultValue={foodProduct?.name}
        errorMessage={state.fieldErrors?.name?.[0]}
        isRequired
      />

      <FormField
        name="kcalPer100g"
        label="カロリー（kcal/100g）"
        type="number"
        inputMode="decimal"
        defaultValue={foodProduct?.kcalPer100g?.toString()}
        errorMessage={state.fieldErrors?.kcalPer100g?.[0]}
        isRequired
      />

      <FormField
        name="packageAmountG"
        label="内容量（g）"
        type="number"
        inputMode="decimal"
        defaultValue={foodProduct?.packageAmountG?.toString()}
        errorMessage={state.fieldErrors?.packageAmountG?.[0]}
        isRequired
      />

      <Select
        name="nutritionType"
        label="区分"
        options={NUTRITION_TYPE_OPTIONS}
        defaultSelectedKey={foodProduct?.nutritionType ?? "complete"}
        errorMessage={state.fieldErrors?.nutritionType?.[0]}
      />

      <Select
        name="textureType"
        label="ドライ／ウェット"
        options={TEXTURE_TYPE_OPTIONS}
        defaultSelectedKey={foodProduct?.textureType ?? "dry"}
        errorMessage={state.fieldErrors?.textureType?.[0]}
      />

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <Button type="submit" variant="primary" isDisabled={isPending}>
        {isPending ? "保存中..." : submitLabel}
      </Button>
    </form>
  );
}
