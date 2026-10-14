"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useRef } from "react";
import { TbSearch } from "react-icons/tb";
import {
  Button,
  Collapsible,
  ComboBox,
  FormField,
  Select,
} from "@/components/ui";
import { CAT_BREEDS, matchesBreed } from "@/features/cats/breeds";
import {
  LIFE_STAGE_LABEL,
  NUTRITION_TYPE_LABEL,
  TEXTURE_TYPE_LABEL,
} from "@/features/food-products/labels";
import styles from "./CatalogSearchForm.module.css";

/** 選択欄の「指定しない」の値。URL には含めない */
const ANY = "any";

function withAnyOption(labels: Record<string, string>) {
  return [
    { value: ANY, label: "指定しない" },
    ...Object.entries(labels).map(([value, label]) => ({ value, label })),
  ];
}

const TEXTURE_TYPE_OPTIONS = withAnyOption(TEXTURE_TYPE_LABEL);
const NUTRITION_TYPE_OPTIONS = withAnyOption(NUTRITION_TYPE_LABEL);
const LIFE_STAGE_OPTIONS = withAnyOption(LIFE_STAGE_LABEL);
const BREED_OPTIONS = CAT_BREEDS.map((breed) => ({
  value: breed.name,
  label: breed.name,
}));

export type CatalogSearchFormValues = {
  q: string;
  manufacturer: string;
  textureType: string | null;
  nutritionType: string | null;
  lifeStage: string | null;
  targetBreed: string;
};

type CatalogSearchFormProps = {
  /** ユーザーが所属する家。2 つ以上あるときは追加先の家を選べるようにする */
  households: { id: string; name: string }[];
  /** 追加先の家 */
  householdId: string;
  /**
   * 家を指定して開いたか。指定して開いたときは、検索し直しても家の指定を URL に残す
   * （追加した後にその家の商品一覧へ戻すため）
   */
  isHouseholdSpecified: boolean;
  defaultValues: CatalogSearchFormValues;
  /** 詳しい条件を最初から開いておくか */
  isAdvancedExpanded: boolean;
};

/**
 * 共通のごはん商品の検索フォーム。条件は URL のクエリで持ち、ページ（サーバー）が検索する。
 * 未入力・「指定しない」の条件は URL に含めない
 */
export function CatalogSearchForm({
  households,
  householdId,
  isHouseholdSpecified,
  defaultValues,
  isAdvancedExpanded,
}: CatalogSearchFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const search = (overrideHouseholdId?: string) => {
    const form = formRef.current;
    if (!form) {
      return;
    }
    const params = new URLSearchParams();
    const selectedHouseholdId = overrideHouseholdId ?? householdId;
    if (isHouseholdSpecified || selectedHouseholdId !== householdId) {
      params.set("householdId", selectedHouseholdId);
    }
    for (const [key, value] of new FormData(form)) {
      if (key === "householdId" || typeof value !== "string") {
        continue;
      }
      const trimmed = value.trim();
      if (trimmed !== "" && trimmed !== ANY) {
        params.set(key, trimmed);
      }
    }
    const query = params.toString();
    router.push(`/food-products/search${query ? `?${query}` : ""}`);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    search();
  };

  return (
    <search>
      <form
        ref={formRef}
        action="/food-products/search"
        method="get"
        className={styles.form}
        onSubmit={handleSubmit}
      >
        {households.length > 1 ? (
          <Select
            name="householdId"
            label="追加先の家"
            options={households.map((household) => ({
              value: household.id,
              label: household.name,
            }))}
            selectedKey={householdId}
            // 「追加済み」の表示を選んだ家に合わせるため、選び直したらすぐに検索し直す
            onSelectionChange={(key) => search(String(key))}
          />
        ) : null}

        <div className={styles.keywordRow}>
          <FormField
            name="q"
            type="search"
            label="商品名・メーカー名"
            placeholder="例：まぐろ　カリカリ"
            defaultValue={defaultValues.q}
            className={styles.keyword}
          />
          <Button type="submit" variant="primary" leftIcon={TbSearch}>
            検索する
          </Button>
        </div>

        <Collapsible
          title="詳しい条件で絞り込む"
          headingLevel={2}
          defaultExpanded={isAdvancedExpanded}
        >
          <div className={styles.advanced}>
            <FormField
              name="manufacturer"
              label="メーカー名"
              defaultValue={defaultValues.manufacturer}
            />
            <Select
              name="textureType"
              label="種類"
              options={TEXTURE_TYPE_OPTIONS}
              defaultSelectedKey={defaultValues.textureType ?? ANY}
            />
            <Select
              name="nutritionType"
              label="区分"
              options={NUTRITION_TYPE_OPTIONS}
              defaultSelectedKey={defaultValues.nutritionType ?? ANY}
            />
            <Select
              name="lifeStage"
              label="対象の猫"
              options={LIFE_STAGE_OPTIONS}
              defaultSelectedKey={defaultValues.lifeStage ?? ANY}
            />
            <ComboBox
              name="targetBreed"
              label="対象の猫種"
              options={BREED_OPTIONS}
              defaultInputValue={defaultValues.targetBreed}
              defaultFilter={matchesBreed}
              description="その猫種向けの商品だけを探します"
              allowsCustomValue
            />
          </div>
        </Collapsible>
      </form>
    </search>
  );
}
