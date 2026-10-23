import { z } from "zod";
import { foodProductFormSchema } from "@/features/food-products/schema";

/** 内容量の候補の上限（管理画面の `MAX_PACKAGE_SIZES` と同じ） */
export const MAX_CATALOG_PACKAGE_SIZES = 10;

/** 検索キーワードの上限（管理画面の `MAX_SEARCH_KEYWORDS` と同じ） */
export const MAX_CATALOG_SEARCH_KEYWORDS = 20;

/** 検索キーワード 1 語の文字数の上限（管理画面の `MAX_SEARCH_KEYWORD_LENGTH` と同じ） */
export const MAX_CATALOG_SEARCH_KEYWORD_LENGTH = 50;

/** 内容量の候補 1 件。g と単位の規則は家のごはん商品の内容量と同じ */
const catalogPackageSizeSchema = z.object({
  amountG: foodProductFormSchema.shape.packageAmountG,
  unit: foodProductFormSchema.shape.packageUnit,
});

/**
 * 共通のごはん商品の値。AI との接続（MCP）から登録・編集するときに使う。
 * 管理画面（`packages/admin/src/catalog/form.ts`）と同じ規則にするため、内容量以外は家の
 * ごはん商品のフォームと同じ項目を使い、内容量は候補（1〜10 件、同じ内容量は不可）にする
 */
export const catalogFoodProductSchema = foodProductFormSchema
  .omit({ packageAmountG: true, packageUnit: true })
  .extend({
    packageSizes: z
      .array(catalogPackageSizeSchema)
      .min(1, "内容量を1件以上入力してください")
      .max(
        MAX_CATALOG_PACKAGE_SIZES,
        `内容量の候補は${MAX_CATALOG_PACKAGE_SIZES}件までです`,
      )
      .refine(
        (sizes) =>
          new Set(
            sizes.map((size) => JSON.stringify([size.amountG, size.unit])),
          ).size === sizes.length,
        "同じ内容量がすでにあります",
      ),
    // 前後の空白を除き、空の語と重複した語は保存しない
    searchKeywords: z
      .array(
        z
          .string()
          .trim()
          .max(
            MAX_CATALOG_SEARCH_KEYWORD_LENGTH,
            `検索キーワードは1語${MAX_CATALOG_SEARCH_KEYWORD_LENGTH}文字以内で入力してください`,
          ),
      )
      .default([])
      .transform((keywords) => [...new Set(keywords.filter(Boolean))])
      .refine(
        (keywords) => keywords.length <= MAX_CATALOG_SEARCH_KEYWORDS,
        `検索キーワードは${MAX_CATALOG_SEARCH_KEYWORDS}件までです`,
      ),
  });

export type CatalogFoodProductInput = z.infer<typeof catalogFoodProductSchema>;
