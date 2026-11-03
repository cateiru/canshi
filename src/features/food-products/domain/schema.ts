import { z } from "zod";
import { FOOD_PRODUCT_LIFE_STAGES } from "@/db/schema";

// FormData から渡る未入力値（空文字・null）を z.coerce.number() が 0 として
// 解釈してしまわないよう、事前に undefined へ正規化してから必須チェックさせる
const emptyToUndefined = (value: unknown) =>
  value == null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;

export const foodProductFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "商品名を入力してください")
    .max(100, "商品名は100文字以内で入力してください"),
  // 未入力は null に揃える（undefined だと更新時に列が更新されず、一度入れた値を消せなくなる）
  manufacturer: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(50, "メーカー名は50文字以内で入力してください")
      .nullish()
      .transform((value) => value ?? null),
  ),
  kcalPer100g: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "カロリー（kcal/100g）を入力してください" })
      .positive("カロリー（kcal/100g）は0より大きい値を入力してください"),
  ),
  packageAmountG: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: "内容量（g）を入力してください" })
      .positive("内容量（g）は0より大きい値を入力してください"),
  ),
  // 未入力は「商品全体の内容量」を表すため null に揃える（undefined だと更新時に
  // 列が更新されず、一度入れた単位を消せなくなる）。「1本」のように数量ごと
  // 入力されても「14g/1本」とならないよう、先頭の「1」は取り除く
  packageUnit: z.preprocess(
    (value) =>
      typeof value === "string"
        ? value.trim().replace(/^[1１]\s*(?=\D)/, "")
        : value,
    z
      .string()
      .max(10, "単位は10文字以内で入力してください")
      .nullish()
      .transform((value) => (value ? value : null)),
  ),
  nutritionType: z.enum(["complete", "general"], {
    error: "総合栄養食／一般食の区分を選択してください",
  }),
  textureType: z.enum(["dry", "wet", "soup"], {
    error: "種類（ドライ・ウェット・スープ）を選択してください",
  }),
  // 対象の猫は複数選べる。何も選ばなければ未設定として空配列で保存する
  lifeStages: z
    .array(
      z.enum(FOOD_PRODUCT_LIFE_STAGES, {
        error: "対象の猫を選び直してください",
      }),
    )
    .default([])
    .transform((stages) =>
      FOOD_PRODUCT_LIFE_STAGES.filter((stage) => stages.includes(stage)),
    ),
  // 未入力はすべての猫種向けを表すため null に揃える
  targetBreed: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(50, "対象の猫種は50文字以内で入力してください")
      .nullish()
      .transform((value) => value ?? null),
  ),
});

export type FoodProductFormInput = z.infer<typeof foodProductFormSchema>;

export type FoodProductFormFieldErrors = Partial<
  Record<keyof FoodProductFormInput, string[]>
>;
