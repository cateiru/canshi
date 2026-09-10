"use client";

import { Button, FormField, Select } from "@/components/ui";
import type { FoodProduct } from "@/db/schema";
import type { MediaLimits } from "@/features/media/limits";
import { MediaAttachmentField } from "@/features/media/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/useMediaFormAction";
import type { MediaAssetView } from "@/features/media/view";
import type { FoodProductFormState } from "./actions";
import styles from "./FoodProductForm.module.css";
import { FOOD_PRODUCT_MEDIA_TYPE } from "./media";

type FormAction = (
  state: FoodProductFormState,
  formData: FormData,
) => Promise<FoodProductFormState>;

type FoodProductFormProps = {
  action: FormAction;
  /**
   * 新規作成でアップロードだけ失敗したときの再送信に使う更新 Action（商品 ID を除いたもの）。
   * 編集フォームでは不要
   */
  updateAction?: (
    recordId: string,
    state: FoodProductFormState,
    formData: FormData,
  ) => Promise<FoodProductFormState>;
  foodProduct?: FoodProduct;
  mediaAssets?: MediaAssetView[];
  mediaLimits: MediaLimits;
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
  updateAction,
  foodProduct,
  mediaAssets,
  mediaLimits,
  submitLabel,
}: FoodProductFormProps) {
  // 商品画像は 1 枚だけ。差し替え時は旧画像を削除する
  const media = useMediaAttachments({
    initial: mediaAssets,
    limits: mediaLimits,
    maxCount: 1,
  });
  const [state, formAction, isPending] = useMediaFormAction({
    action,
    updateAction: updateAction
      ? (recordId) => updateAction.bind(null, recordId)
      : undefined,
    initialState,
    recordType: FOOD_PRODUCT_MEDIA_TYPE,
    media,
    redirectTo: "/food-products",
  });

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

      <MediaAttachmentField
        controller={media}
        label="商品画像"
        single
        isDisabled={isPending}
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
