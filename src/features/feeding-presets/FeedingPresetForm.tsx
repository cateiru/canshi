"use client";

import { useActionState, useState } from "react";
import { TbCheck, TbPlus, TbX } from "react-icons/tb";
import { Button, FormField, Select } from "@/components/ui";
import type { FoodProduct } from "@/db/schema";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
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
  /** 商品 ID → 商品画像の URL（画像のない商品は含まない） */
  foodProductImageUrls: Record<string, string>;
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
  foodProductImageUrls,
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
            <fieldset
              key={item.key}
              className={styles.itemCard}
              aria-label={`商品 ${index + 1}`}
            >
              <div className={styles.productRow}>
                <div className={styles.productImage}>
                  <FoodProductImage
                    name={
                      foodProducts.find(
                        (foodProduct) => foodProduct.id === item.foodProductId,
                      )?.name ?? "商品"
                    }
                    thumbnailUrl={foodProductImageUrls[item.foodProductId]}
                  />
                </div>
                <div className={styles.productSelect}>
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
                </div>
                {items.length > 1 ? (
                  <span
                    className={styles.removeAction}
                    title={`商品 ${index + 1}を削除`}
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      className={styles.removeButton}
                      aria-label={`商品 ${index + 1}を削除`}
                      onPress={() => removeItem(index)}
                    >
                      <TbX aria-hidden="true" size={20} />
                    </Button>
                  </span>
                ) : null}
              </div>

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
            </fieldset>
          );
        })}
      </div>

      {state.fieldErrors?.items?.[0] ? (
        <p className={styles.errorMessage}>{state.fieldErrors.items[0]}</p>
      ) : null}

      <Button
        type="button"
        variant="secondary"
        className={styles.addButton}
        onPress={addItem}
      >
        <TbPlus aria-hidden="true" size={18} />
        商品を追加する
      </Button>

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <Button type="submit" variant="primary" isDisabled={isPending}>
        <TbCheck aria-hidden="true" size={18} />
        {isPending ? "保存中..." : submitLabel}
      </Button>
    </form>
  );
}
