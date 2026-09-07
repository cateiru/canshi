"use client";

import { useActionState, useState } from "react";
import { Button, FormField, Select } from "@/components/ui";
import type { FeedingRecord, FoodProduct } from "@/db/schema";
import { splitDateTimeUtc } from "@/features/shared/datetime";
import type { FeedingRecordFormState } from "./actions";
import styles from "./FeedingRecordForm.module.css";

type FeedingRecordFormProps = {
  action: (
    state: FeedingRecordFormState,
    formData: FormData,
  ) => Promise<FeedingRecordFormState>;
  foodProducts: FoodProduct[];
  recentlyUsedFoodProductIds: string[];
  feedingRecord?: FeedingRecord;
  submitLabel: string;
};

const initialState: FeedingRecordFormState = {};

export function FeedingRecordForm({
  action,
  foodProducts,
  recentlyUsedFoodProductIds,
  feedingRecord,
  submitLabel,
}: FeedingRecordFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [foodProductId, setFoodProductId] = useState(
    feedingRecord?.foodProductId ??
      recentlyUsedFoodProductIds[0] ??
      foodProducts[0]?.id ??
      "",
  );

  const { date: defaultDate, time: defaultTime } = splitDateTimeUtc(
    feedingRecord?.occurredAt ?? new Date(),
  );

  const foodProductOptions = foodProducts.map((foodProduct) => ({
    value: foodProduct.id,
    label: foodProduct.name,
  }));

  const recentFoodProducts = recentlyUsedFoodProductIds
    .map((id) => foodProducts.find((foodProduct) => foodProduct.id === id))
    .filter((foodProduct): foodProduct is FoodProduct => foodProduct != null);

  return (
    <form action={formAction} className={styles.form}>
      {recentFoodProducts.length > 0 ? (
        <div className={styles.quickSelect}>
          <span className={styles.quickSelectLabel}>よく使う商品</span>
          <div className={styles.quickSelectOptions}>
            {recentFoodProducts.map((foodProduct) => (
              <Button
                key={foodProduct.id}
                type="button"
                variant={
                  foodProduct.id === foodProductId ? "primary" : "secondary"
                }
                onPress={() => setFoodProductId(foodProduct.id)}
              >
                {foodProduct.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <Select
        name="foodProductId"
        label="商品"
        options={foodProductOptions}
        selectedKey={foodProductId}
        onSelectionChange={(key) => setFoodProductId(String(key))}
        errorMessage={state.fieldErrors?.foodProductId?.[0]}
      />

      <div className={styles.row}>
        <FormField
          name="occurredDate"
          label="発生日"
          type="date"
          defaultValue={defaultDate}
          errorMessage={state.fieldErrors?.occurredDate?.[0]}
          isRequired
        />
        <FormField
          name="occurredTime"
          label="発生時刻"
          type="time"
          defaultValue={defaultTime}
          errorMessage={state.fieldErrors?.occurredTime?.[0]}
          isRequired
        />
      </div>

      <FormField
        name="givenAmountG"
        label="与えた量（g）"
        type="number"
        inputMode="decimal"
        defaultValue={feedingRecord?.givenAmountG?.toString()}
        errorMessage={state.fieldErrors?.givenAmountG?.[0]}
        isRequired
      />

      <FormField
        name="leftoverAmountG"
        label="残した量（g）"
        type="number"
        inputMode="decimal"
        defaultValue={feedingRecord?.leftoverAmountG?.toString() ?? "0"}
        errorMessage={state.fieldErrors?.leftoverAmountG?.[0]}
        isRequired
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
