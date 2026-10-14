/**
 * 共通のごはん商品の登録・編集フォームの入力を検証する。メインアプリのごはん商品のフォーム
 * （`src/features/food-products/schema.ts`）と同じ規則にする。パッケージ境界をまたいで
 * import しないため、メインアプリで規則を変えたときはここも合わせて更新すること
 */

/** 対象の猫（ライフステージ）。メインアプリの `FOOD_PRODUCT_LIFE_STAGES` と同じ順にする */
export const LIFE_STAGES = ["kitten", "adult", "senior", "care"] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export const NUTRITION_TYPES = ["complete", "general"] as const;
export type NutritionType = (typeof NUTRITION_TYPES)[number];

export const TEXTURE_TYPES = ["dry", "wet", "soup"] as const;
export type TextureType = (typeof TEXTURE_TYPES)[number];

export interface CatalogFoodProductValues {
  name: string;
  manufacturer: string | null;
  kcalPer100g: number;
  packageAmountG: number;
  packageUnit: string | null;
  nutritionType: NutritionType;
  textureType: TextureType;
  lifeStages: LifeStage[];
  targetBreed: string | null;
}

/** フォームを表示し直すときの入力値（送られたままの文字列） */
export interface CatalogFoodProductInput {
  name: string;
  manufacturer: string;
  kcalPer100g: string;
  packageAmountG: string;
  packageUnit: string;
  nutritionType: string;
  textureType: string;
  lifeStages: string[];
  targetBreed: string;
}

export type CatalogFoodProductErrors = Partial<
  Record<keyof CatalogFoodProductInput | "image", string>
>;

/** Hono の `parseBody({ all: true })` の結果 */
export type FormBody = Record<string, string | File | (string | File)[]>;

export type ParsedCatalogFoodProductForm =
  | {
      ok: true;
      values: CatalogFoodProductValues;
      /** 新しく選んだ画像。選んでいなければ null */
      image: File | null;
      /** 編集で「画像を削除する」を選んだか */
      removeImage: boolean;
    }
  | {
      ok: false;
      input: CatalogFoodProductInput;
      errors: CatalogFoodProductErrors;
    };

function text(body: FormBody, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value : "";
}

function texts(body: FormBody, key: string): string[] {
  const value = body[key];
  const list = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value];
  return list.filter((item): item is string => typeof item === "string");
}

function includes<T extends string>(
  options: readonly T[],
  value: string,
): value is T {
  return (options as readonly string[]).includes(value);
}

function positiveNumber(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function parseCatalogFoodProductForm(
  body: FormBody,
): ParsedCatalogFoodProductForm {
  const input: CatalogFoodProductInput = {
    name: text(body, "name"),
    manufacturer: text(body, "manufacturer"),
    kcalPer100g: text(body, "kcalPer100g"),
    packageAmountG: text(body, "packageAmountG"),
    packageUnit: text(body, "packageUnit"),
    nutritionType: text(body, "nutritionType"),
    textureType: text(body, "textureType"),
    lifeStages: texts(body, "lifeStages"),
    targetBreed: text(body, "targetBreed"),
  };
  const errors: CatalogFoodProductErrors = {};

  const name = input.name.trim();
  if (name === "") {
    errors.name = "商品名を入力してください";
  } else if (name.length > 100) {
    errors.name = "商品名は100文字以内で入力してください";
  }
  const manufacturer = input.manufacturer.trim();
  if (manufacturer.length > 50) {
    errors.manufacturer = "メーカー名は50文字以内で入力してください";
  }
  const kcalPer100g = positiveNumber(input.kcalPer100g);
  if (kcalPer100g === null) {
    errors.kcalPer100g =
      "カロリー（kcal/100g）は0より大きい値を入力してください";
  }
  const packageAmountG = positiveNumber(input.packageAmountG);
  if (packageAmountG === null) {
    errors.packageAmountG = "内容量（g）は0より大きい値を入力してください";
  }
  // 「1本」のように数量ごと入力されても「14g/1本」とならないよう、先頭の「1」は取り除く
  const packageUnit = input.packageUnit.trim().replace(/^[1１]\s*(?=\D)/, "");
  if (packageUnit.length > 10) {
    errors.packageUnit = "単位は10文字以内で入力してください";
  }
  const { nutritionType, textureType } = input;
  if (!includes(NUTRITION_TYPES, nutritionType)) {
    errors.nutritionType = "総合栄養食／一般食の区分を選択してください";
  }
  if (!includes(TEXTURE_TYPES, textureType)) {
    errors.textureType = "種類（ドライ・ウェット・スープ）を選択してください";
  }
  if (!input.lifeStages.every((stage) => includes(LIFE_STAGES, stage))) {
    errors.lifeStages = "対象の猫を選び直してください";
  }
  const targetBreed = input.targetBreed.trim();
  if (targetBreed.length > 50) {
    errors.targetBreed = "対象の猫種は50文字以内で入力してください";
  }

  if (
    Object.keys(errors).length > 0 ||
    kcalPer100g === null ||
    packageAmountG === null ||
    !includes(NUTRITION_TYPES, nutritionType) ||
    !includes(TEXTURE_TYPES, textureType)
  ) {
    return { ok: false, input, errors };
  }

  const image = body.image;
  return {
    ok: true,
    values: {
      name,
      manufacturer: manufacturer || null,
      kcalPer100g,
      packageAmountG,
      packageUnit: packageUnit || null,
      nutritionType,
      textureType,
      // メインアプリと同じく、選んだ順ではなく決まった順で保存する
      lifeStages: LIFE_STAGES.filter((stage) =>
        input.lifeStages.includes(stage),
      ),
      targetBreed: targetBreed || null,
    },
    // ファイルを選ばずに送ると、空のファイルが届く
    image: image instanceof File && image.size > 0 ? image : null,
    removeImage: text(body, "removeImage") !== "",
  };
}

/** 保存済みの値を、フォームの入力値にする（編集フォームの初期値） */
export function toInput(
  values: CatalogFoodProductValues,
): CatalogFoodProductInput {
  return {
    name: values.name,
    manufacturer: values.manufacturer ?? "",
    kcalPer100g: String(values.kcalPer100g),
    packageAmountG: String(values.packageAmountG),
    packageUnit: values.packageUnit ?? "",
    nutritionType: values.nutritionType,
    textureType: values.textureType,
    lifeStages: values.lifeStages,
    targetBreed: values.targetBreed ?? "",
  };
}

export const EMPTY_INPUT: CatalogFoodProductInput = {
  name: "",
  manufacturer: "",
  kcalPer100g: "",
  packageAmountG: "",
  packageUnit: "",
  nutritionType: "complete",
  textureType: "dry",
  lifeStages: [],
  targetBreed: "",
};
