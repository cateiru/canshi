"use client";

import { useActionState, useState } from "react";
import {
  TbCalendar,
  TbCheck,
  TbHistory,
  TbPlus,
  TbStack2,
  TbX,
} from "react-icons/tb";
import { Button, FormField, Select } from "@/components/ui";
import type { FoodProduct } from "@/db/schema";
import type { FeedingPresetWithItems } from "@/features/feeding-presets/queries";
import { FoodProductImage } from "@/features/food-products/FoodProductImage";
import { getLocalNowParts, splitDateTimeUtc } from "@/features/shared/datetime";
import type { FeedingRecordFormState } from "./actions";
import styles from "./FeedingRecordForm.module.css";
import type { FeedingRecordWithItems } from "./queries";

type ItemRow = {
  key: string;
  foodProductId: string;
  givenAmountG: string;
  leftoverAmountG: string;
};

type FeedingRecordFormProps = {
  action: (
    state: FeedingRecordFormState,
    formData: FormData,
  ) => Promise<FeedingRecordFormState>;
  foodProducts: FoodProduct[];
  /** 商品 ID → 商品画像の URL（画像のない商品は含まない） */
  foodProductImageUrls: Record<string, string>;
  recentlyUsedFoodProductIds: string[];
  presets: FeedingPresetWithItems[];
  feedingRecord?: FeedingRecordWithItems;
  submitLabel: string;
};

const initialState: FeedingRecordFormState = {};

function createEmptyRow(foodProductId: string): ItemRow {
  return {
    key: crypto.randomUUID(),
    foodProductId,
    givenAmountG: "",
    leftoverAmountG: "0",
  };
}

export function FeedingRecordForm({
  action,
  foodProducts,
  foodProductImageUrls,
  recentlyUsedFoodProductIds,
  presets,
  feedingRecord,
  submitLabel,
}: FeedingRecordFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  const defaultFoodProductId =
    recentlyUsedFoodProductIds[0] ?? foodProducts[0]?.id ?? "";

  const [items, setItems] = useState<ItemRow[]>(() =>
    feedingRecord && feedingRecord.items.length > 0
      ? feedingRecord.items.map((item) => ({
          key: item.id,
          foodProductId: item.foodProductId,
          givenAmountG: item.givenAmountG.toString(),
          leftoverAmountG: item.leftoverAmountG.toString(),
        }))
      : [createEmptyRow(defaultFoodProductId)],
  );

  // new Date() を毎レンダリングで評価すると defaultValue が再レンダリング
  // のたびに変わってしまうため、マウント時に一度だけ計算する
  const [now] = useState(() => new Date());
  const { date: defaultDate, time: defaultTime } = feedingRecord?.occurredAt
    ? splitDateTimeUtc(feedingRecord.occurredAt)
    : getLocalNowParts(now);

  const foodProductOptions = foodProducts.map((foodProduct) => ({
    value: foodProduct.id,
    label: foodProduct.name,
  }));

  const recentFoodProducts = recentlyUsedFoodProductIds
    .map((id) => foodProducts.find((foodProduct) => foodProduct.id === id))
    .filter((foodProduct): foodProduct is FoodProduct => foodProduct != null);

  const updateItem = (index: number, patch: Partial<ItemRow>) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const addItem = (foodProductId: string) => {
    setItems((current) => [...current, createEmptyRow(foodProductId)]);
  };

  const removeItem = (index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  };

  // プリセットを選ぶと、現在の商品行をプリセットの内容で置き換えて
  // フォームを自動でフィルインする（残した量は毎回の実測値のため常に0で初期化）
  const applyPreset = (preset: FeedingPresetWithItems) => {
    setItems(
      preset.items.map((item) => ({
        key: crypto.randomUUID(),
        foodProductId: item.foodProductId,
        givenAmountG: item.givenAmountG.toString(),
        leftoverAmountG: "0",
      })),
    );
  };

  return (
    <form action={formAction} className={styles.form}>
      <section
        className={styles.dateSection}
        aria-labelledby="feeding-date-heading"
      >
        <h2 id="feeding-date-heading" className={styles.sectionHeading}>
          <TbCalendar aria-hidden="true" size={18} />
          食事の日時
        </h2>
        <div className={styles.row}>
          <FormField
            name="occurredDate"
            label="日付"
            type="date"
            defaultValue={defaultDate}
            errorMessage={state.fieldErrors?.occurredDate?.[0]}
            isRequired
          />
          <FormField
            name="occurredTime"
            label="時刻"
            type="time"
            defaultValue={defaultTime}
            errorMessage={state.fieldErrors?.occurredTime?.[0]}
            isRequired
          />
        </div>
      </section>

      {presets.length > 0 ? (
        <div className={styles.quickSelect}>
          <h2 className={styles.sectionHeading}>
            <TbStack2 aria-hidden="true" size={18} />
            プリセット
          </h2>
          <div className={styles.quickSelectOptions}>
            {presets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="secondary"
                className={styles.quickSelectButton}
                onPress={() => applyPreset(preset)}
              >
                <span className={styles.quickSelectName}>{preset.name}</span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {recentFoodProducts.length > 0 ? (
        <div className={styles.quickSelect}>
          <h2 className={styles.sectionHeading}>
            <TbHistory aria-hidden="true" size={18} />
            最近使った商品
          </h2>
          <div className={styles.quickSelectOptions}>
            {recentFoodProducts.map((foodProduct) => (
              <Button
                key={foodProduct.id}
                type="button"
                variant="secondary"
                className={styles.quickSelectButton}
                aria-label={`${foodProduct.name}を追加`}
                onPress={() => addItem(foodProduct.id)}
              >
                <span className={styles.productImage}>
                  <FoodProductImage
                    name={foodProduct.name}
                    thumbnailUrl={foodProductImageUrls[foodProduct.id]}
                    size="sm"
                  />
                </span>
                <span className={styles.quickSelectName}>
                  {foodProduct.name}
                </span>
                <TbPlus aria-hidden="true" size={16} />
              </Button>
            ))}
          </div>
        </div>
      ) : null}

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
                <span className={styles.productImage}>
                  <FoodProductImage
                    name={
                      foodProducts.find(
                        (foodProduct) => foodProduct.id === item.foodProductId,
                      )?.name ?? "商品"
                    }
                    thumbnailUrl={foodProductImageUrls[item.foodProductId]}
                  />
                </span>
                <div className={styles.productSelect}>
                  <Select
                    className={styles.foodSelect}
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
                  <span className={styles.removeAction} title="この商品を削除">
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

              <div className={styles.row}>
                <FormField
                  name={`items.${index}.givenAmountG`}
                  label="与えた量（g）"
                  type="number"
                  inputMode="decimal"
                  value={item.givenAmountG}
                  onChange={(value) =>
                    updateItem(index, { givenAmountG: value })
                  }
                  errorMessage={itemErrors?.givenAmountG?.[0]}
                  isRequired
                />
                <FormField
                  name={`items.${index}.leftoverAmountG`}
                  label="残した量（g）"
                  type="number"
                  inputMode="decimal"
                  value={item.leftoverAmountG}
                  onChange={(value) =>
                    updateItem(index, { leftoverAmountG: value })
                  }
                  errorMessage={itemErrors?.leftoverAmountG?.[0]}
                  isRequired
                />
              </div>
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
        onPress={() => addItem(foodProducts[0]?.id ?? "")}
      >
        <TbPlus aria-hidden="true" size={18} />
        商品を追加する
      </Button>

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
