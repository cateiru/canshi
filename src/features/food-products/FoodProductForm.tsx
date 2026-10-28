"use client";

import { useState } from "react";
import {
  Button,
  Checkbox,
  ComboBox,
  FormField,
  FormGroup,
  FormRow,
  Select,
} from "@/components/ui";
import type { FoodProduct, FoodProductLifeStage } from "@/db/schema";
import { CAT_BREEDS, matchesBreed } from "@/features/cats/breeds";
import { HouseholdField } from "@/features/households/HouseholdField";
import type { MediaLimits } from "@/features/media/limits";
import { MediaAttachmentField } from "@/features/media/MediaAttachmentField";
import { useMediaAttachments } from "@/features/media/useMediaAttachments";
import { useMediaFormAction } from "@/features/media/useMediaFormAction";
import type { MediaAssetView } from "@/features/media/view";
import type { FoodProductFormState } from "./actions";
import styles from "./FoodProductForm.module.css";
import { LIFE_STAGE_LABEL, TEXTURE_TYPE_LABEL } from "./labels";

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
  /**
   * 登録先として選べる家（ユーザーが所属する家）。新規登録でだけ渡す。
   * 登録後は家を変えられない（ほかの家のプリセット・ごはん記録から参照されないようにするため）
   */
  households?: { id: string; name: string }[];
  /**
   * 新規登録で最初から選んでおく家。指定したときは、保存後に選んだ家の商品一覧へ戻る
   * （家の商品一覧やごはん記録の画面から来たときに、その家の一覧へ戻すため）
   */
  defaultHouseholdId?: string;
  mediaAssets?: MediaAssetView[];
  mediaLimits: MediaLimits;
  submitLabel: string;
};

const initialState: FoodProductFormState = {};

const NUTRITION_TYPE_OPTIONS = [
  { value: "complete", label: "総合栄養食" },
  { value: "general", label: "一般食" },
];

const TEXTURE_TYPE_OPTIONS = Object.entries(TEXTURE_TYPE_LABEL).map(
  ([value, label]) => ({ value, label }),
);

const LIFE_STAGE_OPTIONS = Object.entries(LIFE_STAGE_LABEL) as [
  FoodProductLifeStage,
  string,
][];

const BREED_OPTIONS = CAT_BREEDS.map((breed) => ({
  value: breed.name,
  label: breed.name,
}));

export function FoodProductForm({
  action,
  updateAction,
  foodProduct,
  households,
  defaultHouseholdId,
  mediaAssets,
  mediaLimits,
  submitLabel,
}: FoodProductFormProps) {
  const [householdId, setHouseholdId] = useState(
    defaultHouseholdId ?? households?.[0]?.id ?? "",
  );
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
    media,
    redirectTo: defaultHouseholdId
      ? `/food-products?householdId=${encodeURIComponent(householdId)}`
      : "/food-products",
  });

  return (
    <form action={formAction} className={styles.form}>
      {households ? (
        <HouseholdField
          households={households}
          value={householdId}
          onChange={setHouseholdId}
          description="選んだ家のメンバーと、この商品を共有します。登録後は変えられません。"
          errorMessage={state.fieldErrors?.householdId?.[0]}
        />
      ) : null}

      <FormField
        name="name"
        label="商品名"
        defaultValue={foodProduct?.name}
        errorMessage={state.fieldErrors?.name?.[0]}
        isRequired
      />

      <FormField
        name="manufacturer"
        label="メーカー名（任意）"
        defaultValue={foodProduct?.manufacturer ?? undefined}
        errorMessage={state.fieldErrors?.manufacturer?.[0]}
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

      <FormRow>
        <FormField
          name="packageAmountG"
          label="内容量（g）"
          type="number"
          inputMode="decimal"
          defaultValue={foodProduct?.packageAmountG?.toString()}
          errorMessage={state.fieldErrors?.packageAmountG?.[0]}
          isRequired
        />
        <FormField
          name="packageUnit"
          label="単位（任意）"
          placeholder="本・袋・パック"
          defaultValue={foodProduct?.packageUnit ?? undefined}
          description="1本・1袋あたりで登録する場合に入力。未入力は商品全体の内容量"
          errorMessage={state.fieldErrors?.packageUnit?.[0]}
        />
      </FormRow>

      <Select
        name="nutritionType"
        label="区分"
        options={NUTRITION_TYPE_OPTIONS}
        defaultSelectedKey={foodProduct?.nutritionType ?? "complete"}
        errorMessage={state.fieldErrors?.nutritionType?.[0]}
      />

      <Select
        name="textureType"
        label="種類"
        options={TEXTURE_TYPE_OPTIONS}
        defaultSelectedKey={foodProduct?.textureType ?? "dry"}
        errorMessage={state.fieldErrors?.textureType?.[0]}
      />

      <FormGroup
        legend="対象の猫（任意）"
        description="複数選択できます。"
        errorMessage={state.fieldErrors?.lifeStages?.[0]}
        isDisabled={isPending}
      >
        <div className={styles.checkboxList}>
          {LIFE_STAGE_OPTIONS.map(([value, label]) => (
            <Checkbox
              key={value}
              name="lifeStages"
              value={value}
              defaultSelected={foodProduct?.lifeStages.includes(value)}
            >
              {label}
            </Checkbox>
          ))}
        </div>
      </FormGroup>

      <ComboBox
        name="targetBreed"
        label="対象の猫種（任意）"
        options={BREED_OPTIONS}
        defaultInputValue={foodProduct?.targetBreed ?? ""}
        defaultFilter={matchesBreed}
        description="特定の猫種向けの商品の場合に入力。未入力はすべての猫種向け"
        errorMessage={state.fieldErrors?.targetBreed?.[0]}
        allowsCustomValue
      />

      <MediaAttachmentField
        controller={media}
        label="商品画像"
        single
        cropSquare
        description="選んだ画像は正方形に切り抜いて保存します。"
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
