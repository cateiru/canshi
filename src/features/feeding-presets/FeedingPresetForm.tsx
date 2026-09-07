"use client";

import { useActionState, useState } from "react";
import { Button, FormField, Select } from "@/components/ui";
import type { FoodProduct } from "@/db/schema";
import type { FeedingPresetFormState } from "./actions";
import styles from "./FeedingPresetForm.module.css";
import type { FeedingPresetWithItems } from "./queries";

type ItemRow = {
  key: string;
  foodProductId: string;
  givenAmountG: string;
};

type FeedingPresetFormProps = {
  action: (
    state: FeedingPresetFormState,
    formData: FormData,
  ) => Promise<FeedingPresetFormState>;
  foodProducts: FoodProduct[];
  preset?: FeedingPresetWithItems;
  submitLabel: string;
};

const initialState: FeedingPresetFormState = {};

function createEmptyRow(foodProductId: string): ItemRow {
  return {
    key: crypto.randomUUID(),
    foodProductId,
    givenAmountG: "",
  };
}

export function FeedingPresetForm({
  action,
  foodProducts,
  preset,
  submitLabel,
}: FeedingPresetFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const [items, setItems] = useState<ItemRow[]>(() =>
    preset && preset.items.length > 0
      ? preset.items.map((item) => ({
          key: item.id,
          foodProductId: item.foodProductId,
          givenAmountG: item.givenAmountG.toString(),
        }))
      : [createEmptyRow(foodProducts[0]?.id ?? "")],
  );

  const foodProductOptions = foodProducts.map((foodProduct) => ({
    value: foodProduct.id,
    label: foodProduct.name,
  }));

  const updateItem = (index: number, patch: Partial<ItemRow>) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      createEmptyRow(foodProducts[0]?.id ?? ""),
    ]);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  return (
    <form action={formAction} className={styles.form}>
      <FormField
        name="name"
        label="プリセット名"
        defaultValue={preset?.name}
        errorMessage={state.fieldErrors?.name?.[0]}
        isRequired
      />

      <div className={styles.itemsList}>
        {items.map((item, index) => {
          const itemErrors = state.fieldErrors?.itemErrors?.[index];
          return (
            <div key={item.key} className={styles.itemCard}>
              <div className={styles.itemHeader}>
                <span className={styles.itemHeaderLabel}>商品 {index + 1}</span>
                {items.length > 1 ? (
                  <Button
                    type="button"
                    variant="danger"
                    onPress={() => removeItem(index)}
                  >
                    削除
                  </Button>
                ) : null}
              </div>

              <Select
                name={`items.${index}.foodProductId`}
                label="商品"
                options={foodProductOptions}
                selectedKey={item.foodProductId}
                onSelectionChange={(key) =>
                  updateItem(index, { foodProductId: String(key) })
                }
                errorMessage={itemErrors?.foodProductId?.[0]}
              />

              <FormField
                name={`items.${index}.givenAmountG`}
                label="与える量（g）"
                type="number"
                inputMode="decimal"
                value={item.givenAmountG}
                onChange={(value) => updateItem(index, { givenAmountG: value })}
                errorMessage={itemErrors?.givenAmountG?.[0]}
                isRequired
              />
            </div>
          );
        })}
      </div>

      {state.fieldErrors?.items?.[0] ? (
        <p className={styles.errorMessage}>{state.fieldErrors.items[0]}</p>
      ) : null}

      <Button type="button" variant="secondary" onPress={addItem}>
        商品を追加する
      </Button>

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <Button type="submit" variant="primary" isDisabled={isPending}>
        {isPending ? "保存中..." : submitLabel}
      </Button>
    </form>
  );
}
