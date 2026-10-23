/**
 * 共通のごはん商品の登録・編集フォームの入力を検証する。メインアプリのごはん商品のフォーム
 * （`src/features/food-products/schema.ts`）と同じ規則にする。パッケージ境界をまたいで
 * import しないため、メインアプリで規則を変えたときはここも合わせて更新すること。
 * AI との接続（MCP）から共通のごはん商品を登録・編集するときの規則
 * （`src/features/catalog-food-products/schema.ts`）とも揃える
 */

/** 対象の猫（ライフステージ）。メインアプリの `FOOD_PRODUCT_LIFE_STAGES` と同じ順にする */
export const LIFE_STAGES = ["kitten", "adult", "senior", "care"] as const;
export type LifeStage = (typeof LIFE_STAGES)[number];

export const NUTRITION_TYPES = ["complete", "general"] as const;
export type NutritionType = (typeof NUTRITION_TYPES)[number];

export const TEXTURE_TYPES = ["dry", "wet", "soup"] as const;
export type TextureType = (typeof TEXTURE_TYPES)[number];

/** 内容量の候補の上限 */
export const MAX_PACKAGE_SIZES = 10;

/** 検索キーワードの上限（メインアプリの `MAX_CATALOG_SEARCH_KEYWORDS` と同じ） */
export const MAX_SEARCH_KEYWORDS = 20;

/** 検索キーワード 1 語の文字数の上限（メインアプリの `MAX_CATALOG_SEARCH_KEYWORD_LENGTH` と同じ） */
export const MAX_SEARCH_KEYWORD_LENGTH = 50;

/**
 * 内容量の候補（メインアプリの `CatalogPackageSize`）。`unit` があるときは 1 単位あたり、
 * ないときは商品全体の内容量
 */
export interface PackageSize {
  amountG: number;
  unit: string | null;
}

export interface CatalogFoodProductValues {
  name: string;
  manufacturer: string | null;
  kcalPer100g: number;
  /** 内容量の候補。1 件以上で、並べた順にメインアプリで表示する */
  packageSizes: PackageSize[];
  nutritionType: NutritionType;
  textureType: TextureType;
  lifeStages: LifeStage[];
  targetBreed: string | null;
  /** 検索キーワード。商品名・メーカー名とは別の呼び方でも検索で見つかるようにする */
  searchKeywords: string[];
}

/** フォームを表示し直すときの入力値（送られたままの文字列） */
export interface CatalogFoodProductInput {
  name: string;
  manufacturer: string;
  kcalPer100g: string;
  /** 内容量の候補の行。空の行は除き、1 行もなければ空の行を 1 つ置く */
  packageSizes: PackageSizeInput[];
  nutritionType: string;
  textureType: string;
  lifeStages: string[];
  targetBreed: string;
  /** 検索キーワード（1 行に 1 語） */
  searchKeywords: string;
}

export interface PackageSizeInput {
  amountG: string;
  unit: string;
}

export type CatalogFoodProductErrors = Partial<
  Record<keyof CatalogFoodProductInput | "image", string>
> & {
  /** 内容量の候補の行ごとのエラー（`input.packageSizes` と同じ並び） */
  packageSizeRows?: Partial<Record<keyof PackageSizeInput, string>>[];
};

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

/** 内容量の候補の単位。「1本」のように数量ごと入力されても「14g/1本」とならないよう、先頭の「1」は取り除く */
function normalizeUnit(value: string): string {
  return value.trim().replace(/^[1１]\s*(?=\D)/, "");
}

/**
 * 内容量の候補の行を読む。g と単位は同じ名前の入力欄を並べて送られるため、添字で対にする
 * （単位が空でも空文字列が届くため、添字はずれない）。どちらも空の行は捨てる
 */
function packageSizeInputs(body: FormBody): PackageSizeInput[] {
  const amounts = texts(body, "packageAmountG");
  const units = texts(body, "packageUnit");
  const rows = Array.from(
    { length: Math.max(amounts.length, units.length) },
    (_, index) => ({ amountG: amounts[index] ?? "", unit: units[index] ?? "" }),
  ).filter((row) => row.amountG.trim() !== "" || row.unit.trim() !== "");
  return rows.length > 0 ? rows : [{ amountG: "", unit: "" }];
}

/** 内容量の候補を検証する。誤りがあれば `errors` に書き込み、null を返す */
function parsePackageSizes(
  rows: PackageSizeInput[],
  errors: CatalogFoodProductErrors,
): PackageSize[] | null {
  const sizes: PackageSize[] = [];
  const rowErrors = rows.map((row) => {
    const rowError: Partial<Record<keyof PackageSizeInput, string>> = {};
    const amountG = positiveNumber(row.amountG);
    if (amountG === null) {
      rowError.amountG = "内容量（g）は0より大きい値を入力してください";
    }
    const unit = normalizeUnit(row.unit);
    if (unit.length > 10) {
      rowError.unit = "単位は10文字以内で入力してください";
    }
    if (amountG !== null && !rowError.unit) {
      if (
        sizes.some(
          (size) => size.amountG === amountG && size.unit === (unit || null),
        )
      ) {
        rowError.amountG = "同じ内容量がすでにあります";
      }
      sizes.push({ amountG, unit: unit || null });
    }
    return rowError;
  });
  if (rowErrors.some((rowError) => Object.keys(rowError).length > 0)) {
    errors.packageSizes = "内容量を確かめてください";
    errors.packageSizeRows = rowErrors;
    return null;
  }
  if (sizes.length > MAX_PACKAGE_SIZES) {
    errors.packageSizes = `内容量の候補は${MAX_PACKAGE_SIZES}件までです`;
    return null;
  }
  return sizes;
}

/**
 * 検索キーワードを 1 行 1 語で読む。前後の空白を除き、空の行と重複した語は捨てる。
 * 誤りがあれば `errors` に書き込み、null を返す
 */
function parseSearchKeywords(
  value: string,
  errors: CatalogFoodProductErrors,
): string[] | null {
  const keywords = [
    ...new Set(
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
  if (keywords.some((keyword) => keyword.length > MAX_SEARCH_KEYWORD_LENGTH)) {
    errors.searchKeywords = `検索キーワードは1語${MAX_SEARCH_KEYWORD_LENGTH}文字以内で入力してください`;
    return null;
  }
  if (keywords.length > MAX_SEARCH_KEYWORDS) {
    errors.searchKeywords = `検索キーワードは${MAX_SEARCH_KEYWORDS}件までです`;
    return null;
  }
  return keywords;
}

export function parseCatalogFoodProductForm(
  body: FormBody,
): ParsedCatalogFoodProductForm {
  const input: CatalogFoodProductInput = {
    name: text(body, "name"),
    manufacturer: text(body, "manufacturer"),
    kcalPer100g: text(body, "kcalPer100g"),
    packageSizes: packageSizeInputs(body),
    nutritionType: text(body, "nutritionType"),
    textureType: text(body, "textureType"),
    lifeStages: texts(body, "lifeStages"),
    targetBreed: text(body, "targetBreed"),
    searchKeywords: text(body, "searchKeywords"),
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
  const packageSizes = parsePackageSizes(input.packageSizes, errors);
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
  const searchKeywords = parseSearchKeywords(input.searchKeywords, errors);

  if (
    Object.keys(errors).length > 0 ||
    kcalPer100g === null ||
    packageSizes === null ||
    searchKeywords === null ||
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
      packageSizes,
      nutritionType,
      textureType,
      // メインアプリと同じく、選んだ順ではなく決まった順で保存する
      lifeStages: LIFE_STAGES.filter((stage) =>
        input.lifeStages.includes(stage),
      ),
      targetBreed: targetBreed || null,
      searchKeywords,
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
    packageSizes: values.packageSizes.map((size) => ({
      amountG: String(size.amountG),
      unit: size.unit ?? "",
    })),
    nutritionType: values.nutritionType,
    textureType: values.textureType,
    lifeStages: values.lifeStages,
    targetBreed: values.targetBreed ?? "",
    searchKeywords: values.searchKeywords.join("\n"),
  };
}

export const EMPTY_INPUT: CatalogFoodProductInput = {
  name: "",
  manufacturer: "",
  kcalPer100g: "",
  packageSizes: [{ amountG: "", unit: "" }],
  nutritionType: "complete",
  textureType: "dry",
  lifeStages: [],
  targetBreed: "",
  searchKeywords: "",
};
