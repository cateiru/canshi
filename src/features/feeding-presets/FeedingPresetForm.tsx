"use client";

import { useState } from "react";
import { TbCheck, TbPlus, TbX } from "react-icons/tb";
import {
  Button,
  FormField,
  IconButton,
  Radio,
  RadioGroup,
  Select,
} from "@/components/ui";
import {
  type FeedingMode,
  type FoodProduct,
  GIVEN_AMOUNT_LEVELS,
  type GivenAmountLevel,
} from "@/db/schema";
import { FeedingModeField } from "@/features/feeding-records/FeedingModeField";
import { GIVEN_AMOUNT_LEVEL_LABEL } from "@/features/feeding-records/labels";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
import { useSubmitActionState } from "@/features/navigation/useSubmitActionState";
import type { FeedingPresetFormState } from "./actions";
import styles from "./FeedingPresetForm.module.css";
import type { FeedingPresetWithItems } from "./queries";

// モードを切り替えても入力済みの値を失わないよう、両モードの値を行ごとに持つ
type ItemRow = {
  key: string;
  foodProductId: string;
  givenAmountG: string;
  givenAmountLevel: GivenAmountLevel;
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
    givenAmountLevel: "normal",
  };
}

export function FeedingPresetForm({
  action,
  foodProducts,
  foodProductImageUrls,
  preset,
  submitLabel,
}: FeedingPresetFormProps) {
  const [state, formAction, isPending] = useSubmitActionState(
    action,
    initialState,
  );

  const [mode, setMode] = useState<FeedingMode>(preset?.mode ?? "strict");
  const [items, setItems] = useState<ItemRow[]>(() =>
    preset && preset.items.length > 0
      ? preset.items.map((item) => ({
          key: item.id,
          foodProductId: item.foodProductId,
          givenAmountG: item.givenAmountG?.toString() ?? "",
          givenAmountLevel: item.givenAmountLevel ?? "normal",
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

      <FeedingModeField
        value={mode}
        onChange={setMode}
        errorMessage={state.fieldErrors?.mode?.[0]}
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
                    <IconButton
                      icon={TbX}
                      className={styles.removeButton}
                      aria-label={`商品 ${index + 1}を削除`}
                      onPress={() => removeItem(index)}
                    />
                  </span>
                ) : null}
              </div>

              {mode === "strict" ? (
                <FormField
                  name={`items.${index}.givenAmountG`}
                  label="与える量（g）"
                  type="number"
                  inputMode="decimal"
                  value={item.givenAmountG}
                  onChange={(value) =>
                    updateItem(index, { givenAmountG: value })
                  }
                  errorMessage={itemErrors?.givenAmountG?.[0]}
                  isRequired
                />
              ) : (
                <div className={styles.levelField}>
                  <RadioGroup
                    name={`items.${index}.givenAmountLevel`}
                    label="与える量"
                    value={item.givenAmountLevel}
                    onChange={(value) =>
                      updateItem(index, {
                        givenAmountLevel: value as GivenAmountLevel,
                      })
                    }
                    isInvalid={itemErrors?.givenAmountLevel != null}
                  >
                    {GIVEN_AMOUNT_LEVELS.map((level) => (
                      <Radio key={level} value={level}>
                        {GIVEN_AMOUNT_LEVEL_LABEL[level]}
                      </Radio>
                    ))}
                  </RadioGroup>
                  {itemErrors?.givenAmountLevel?.[0] ? (
                    <p className={styles.errorMessage}>
                      {itemErrors.givenAmountLevel[0]}
                    </p>
                  ) : null}
                </div>
              )}
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
        leftIcon={TbPlus}
      >
        商品を追加する
      </Button>

      {state.formError ? (
        <p className={styles.errorMessage}>{state.formError}</p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        isDisabled={isPending}
        leftIcon={TbCheck}
      >
        {isPending ? "保存中..." : submitLabel}
      </Button>
    </form>
  );
}
