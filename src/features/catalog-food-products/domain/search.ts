import {
  FOOD_PRODUCT_LIFE_STAGES,
  type FoodProduct,
  type FoodProductLifeStage,
} from "@/db/schema";

/** 共通のごはん商品の検索条件。未指定の条件では絞り込まない */
export type CatalogSearchCriteria = {
  /** 商品名・メーカー名・検索キーワードのキーワード。空白で区切ったすべての語を含む商品に絞る */
  keywords: string[];
  /** メーカー名（部分一致） */
  manufacturer: string | null;
  textureType: FoodProduct["textureType"] | null;
  nutritionType: FoodProduct["nutritionType"] | null;
  /** 対象の猫。この対象を含む商品に絞る */
  lifeStage: FoodProductLifeStage | null;
  /** 対象の猫種（完全一致） */
  targetBreed: string | null;
};

type SearchParamValue = string | string[] | undefined;

const TEXTURE_TYPES = ["dry", "wet", "soup"] as const;
const NUTRITION_TYPES = ["complete", "general"] as const;

/** 1 つの条件に受け付ける文字数の上限（LIKE に渡す長さを抑える） */
const MAX_TEXT_LENGTH = 100;

/**
 * キーワードの数の上限。キーワードは 1 語につき商品名・メーカー名・検索キーワードの 3 個のパラメーターを使うため、
 * 詳しい条件と件数の上限を足しても D1 のバインドパラメーターの上限（`src/db/batch.ts` の
 * `D1_MAX_BOUND_PARAMETERS`）に十分収まる数にする。それより後ろの語は使わない
 */
export const MAX_KEYWORDS = 10;

function readText(value: SearchParamValue): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().slice(0, MAX_TEXT_LENGTH);
  return trimmed === "" ? null : trimmed;
}

function readEnum<T extends string>(
  value: SearchParamValue,
  options: readonly T[],
): T | null {
  return typeof value === "string" &&
    (options as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * 検索ページのクエリ（`q`・`manufacturer`・`textureType`・`nutritionType`・`lifeStage`・
 * `targetBreed`）を検索条件にする。選択肢にない値は指定されなかったものとして扱う
 */
export function parseCatalogSearchParams(
  params: Record<string, SearchParamValue>,
): CatalogSearchCriteria {
  return {
    // 同じ語は 1 回だけ使い、上限より後ろの語は使わない
    keywords: [
      ...new Set((readText(params.q) ?? "").split(/\s+/).filter(Boolean)),
    ].slice(0, MAX_KEYWORDS),
    manufacturer: readText(params.manufacturer),
    textureType: readEnum(params.textureType, TEXTURE_TYPES),
    nutritionType: readEnum(params.nutritionType, NUTRITION_TYPES),
    lifeStage: readEnum(params.lifeStage, FOOD_PRODUCT_LIFE_STAGES),
    targetBreed: readText(params.targetBreed),
  };
}

/** キーワード以外の詳細な条件を 1 つでも指定しているか */
export function hasAdvancedCriteria(criteria: CatalogSearchCriteria): boolean {
  return (
    criteria.manufacturer != null ||
    criteria.textureType != null ||
    criteria.nutritionType != null ||
    criteria.lifeStage != null ||
    criteria.targetBreed != null
  );
}

/**
 * LIKE の部分一致のパターン。利用者の入力に含まれる `%`・`_` をワイルドカードとして
 * 扱わないよう、`\` でエスケープする（クエリでは `ESCAPE '\'` を指定する）
 */
export function toContainsPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}
