import type { McpServer } from "@modelcontextprotocol/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  type CatalogFoodProduct,
  catalogFoodProducts,
  FOOD_PRODUCT_LIFE_STAGES,
} from "@/db/schema";
import { getUserById } from "@/features/auth/users";
import {
  CATALOG_IMAGE_MAX_EDGE,
  type CatalogImage,
  toCatalogImage,
} from "@/features/catalog-food-products/image";
import { CATALOG_FOOD_PRODUCT_MEDIA_TYPE } from "@/features/catalog-food-products/media";
import {
  createCatalogFoodProduct,
  replaceCatalogFoodProductImage,
  updateCatalogFoodProduct,
} from "@/features/catalog-food-products/mutations";
import { catalogPackageSizes } from "@/features/catalog-food-products/packageSizes";
import {
  CATALOG_SEARCH_LIMIT,
  searchCatalogFoodProducts,
} from "@/features/catalog-food-products/queries";
import {
  catalogFoodProductSchema,
  MAX_CATALOG_PACKAGE_SIZES,
  MAX_CATALOG_SEARCH_KEYWORD_LENGTH,
  MAX_CATALOG_SEARCH_KEYWORDS,
} from "@/features/catalog-food-products/schema";
import { parseCatalogSearchParams } from "@/features/catalog-food-products/search";
import { listMediaAssetsByRecords } from "@/features/media/queries";
import { MediaUploadError } from "@/features/media/storage";
import { MAX_DECODE_PIXELS } from "@/features/media/thumbnailSize";
import {
  type FormValues,
  mergeFormValues,
  parseFormValues,
  toOptionalValue,
} from "../formValues";
import {
  isCatalogOperationAllowedForMcp,
  type McpCatalogOperation,
} from "../permissionRules";
import {
  errorResult,
  jsonResult,
  type McpConnection,
  type McpToolContext,
  operationNotAllowedMessage,
  resolvePermissions,
} from "./context";
import {
  decodeImageBase64,
  INVALID_IMAGE_ERROR,
  MAX_IMAGE_BASE64_LENGTH,
} from "./imageArgs";

const NOT_ADMIN_ERROR =
  "共通のごはん商品は、CANSHI の管理者のユーザーだけが扱えます";

const PRODUCT_DESCRIPTION =
  "共通のごはん商品は、すべての家のユーザーが検索し、自分の家のごはん商品として追加できる商品。" +
  "kcalPer100g（100g あたりのカロリー）は正の数。" +
  `packageSizes は内容量の候補（1〜${MAX_CATALOG_PACKAGE_SIZES} 件、同じ内容量は不可）で、` +
  "家に追加するときに 1 つ選ぶ。先頭の候補が既定になる。" +
  "amountG は内容量（g、正の数）、unit は内容量の単位（「本」「袋」など、10文字以内。" +
  "1 本 14g なら amountG=14、unit=本。null なら商品全体の内容量）。" +
  "nutritionType は complete=総合栄養食、general=一般食。" +
  "textureType は dry=ドライ、wet=ウェット、soup=スープ。" +
  `lifeStages は対象の猫（${FOOD_PRODUCT_LIFE_STAGES.join("・")}。kitten=子猫、adult=成猫、` +
  "senior=シニア、care=療法食などのケア）で、複数を指定できる。" +
  "targetBreed は対象の猫種（未指定ならすべての猫種向け）。" +
  `searchKeywords は検索キーワード（${MAX_CATALOG_SEARCH_KEYWORDS} 件まで、1 語 ${MAX_CATALOG_SEARCH_KEYWORD_LENGTH} 文字以内）で、` +
  "商品名・メーカー名とは別の呼び方（「CIAO ちゅ〜る」に対する「ちゅーる」「ちゃおちゅーる」など）を登録すると、" +
  "その呼び方の一部でも検索で見つかる。" +
  "家に追加済みのごはん商品は内容を写したものなので、共通のごはん商品を編集しても変わらない。";

const IMAGE_DESCRIPTION =
  "商品の画像（JPEG・PNG・WebP・GIF）を base64 で指定する（data URL の形式も可）。" +
  "大きさ・縦横比は問わない。サーバーで画像の中央を正方形に切り抜き、" +
  `一辺 ${CATALOG_IMAGE_MAX_EDGE}px 以下の JPEG にして保存する（透明な部分は白にする）。` +
  "商品が中央に写った画像を選ぶ。" +
  `画素数は ${MAX_DECODE_PIXELS / 1_000_000} 百万画素以下にする（長辺 2000px 程度に縮小してから送る）。` +
  "指定すると今の画像を置き換える。";

const productFields = {
  name: z.string().optional().describe("商品名（100文字以内）"),
  manufacturer: z
    .string()
    .nullable()
    .optional()
    .describe("メーカー名（50文字以内）。null を指定すると空にする"),
  kcalPer100g: z.number().optional().describe("100g あたりのカロリー（kcal）"),
  packageSizes: z
    .array(
      z.object({
        amountG: z.number().describe("内容量（g）"),
        unit: z
          .string()
          .nullable()
          .optional()
          .describe("内容量の単位。null・省略で商品全体の内容量"),
      }),
    )
    .optional()
    .describe("内容量の候補。編集で指定すると、候補をすべて置き換える"),
  nutritionType: z.enum(["complete", "general"]).optional(),
  textureType: z.enum(["dry", "wet", "soup"]).optional(),
  lifeStages: z.array(z.enum(FOOD_PRODUCT_LIFE_STAGES)).optional(),
  targetBreed: z
    .string()
    .nullable()
    .optional()
    .describe(
      "対象の猫種（50文字以内）。null を指定するとすべての猫種向けにする",
    ),
  searchKeywords: z
    .array(z.string())
    .optional()
    .describe(
      "検索キーワード。編集で指定すると、キーワードをすべて置き換える（空配列で未設定にする）",
    ),
  image: z
    .string()
    .max(MAX_IMAGE_BASE64_LENGTH)
    .optional()
    .describe(IMAGE_DESCRIPTION),
};

function toCatalogFoodProductSummary(
  product: CatalogFoodProduct,
  hasImage: boolean,
) {
  return {
    id: product.id,
    name: product.name,
    manufacturer: product.manufacturer,
    kcalPer100g: product.kcalPer100g,
    packageSizes: catalogPackageSizes(product),
    nutritionType: product.nutritionType,
    textureType: product.textureType,
    lifeStages: product.lifeStages,
    targetBreed: product.targetBreed,
    searchKeywords: product.searchKeywords,
    hasImage,
  };
}

function toFormValues(product: CatalogFoodProduct): FormValues {
  return {
    name: product.name,
    manufacturer: toOptionalValue(product.manufacturer),
    kcalPer100g: product.kcalPer100g,
    packageSizes: catalogPackageSizes(product),
    nutritionType: product.nutritionType,
    textureType: product.textureType,
    lifeStages: product.lifeStages,
    targetBreed: toOptionalValue(product.targetBreed),
    searchKeywords: product.searchKeywords,
  };
}

/** フォームの値に含めない引数を除く */
function formArgs(args: Record<string, unknown>) {
  const { id: _id, image: _image, ...rest } = args;
  return rest;
}

/**
 * 引数の画像を読み、共通のごはん商品の画像の形（正方形の JPEG）にする。商品を保存する前に
 * 呼び、画像でない・読み込めないときは商品を保存せずに断る。失敗したら AI に返すメッセージ
 */
function prepareImage(
  value: string | undefined,
): { image: CatalogImage | null } | { error: string } {
  if (value === undefined) {
    return { image: null };
  }
  const bytes = decodeImageBase64(value);
  if (!bytes) {
    return { error: INVALID_IMAGE_ERROR };
  }
  try {
    return { image: toCatalogImage(bytes) };
  } catch (error) {
    if (error instanceof MediaUploadError) {
      return { error: `画像を保存できませんでした。${error.message}` };
    }
    throw error;
  }
}

/**
 * 商品の画像を差し替える。失敗したら AI に返すメッセージ（商品が見つからないときも含む）。
 * 商品を保存した後に呼ぶため、R2・D1 の通信エラーなどの想定外の失敗も投げ直さずにメッセージにする
 * （投げ直すと、保存済みの商品の ID を返せず、AI が追加をやり直して商品が重複する）
 */
async function saveImage(
  ctx: McpToolContext,
  productId: string,
  image: CatalogImage,
): Promise<string | null> {
  try {
    if (!(await replaceCatalogFoodProductImage(productId, image, ctx.env))) {
      return `画像を保存できませんでした。id="${productId}" の共通のごはん商品が見つかりません`;
    }
  } catch (error) {
    if (error instanceof MediaUploadError) {
      return `画像を保存できませんでした。${error.message}`;
    }
    console.error("共通のごはん商品の画像を保存できませんでした", error);
    return "画像を保存できませんでした。時間をおいて、update_catalog_food_product で画像だけをもう一度指定してください";
  }
  return null;
}

/**
 * 接続を求め、共通のごはん商品の操作を行えるときだけ接続を返す。ユーザーが今 admin で、
 * この接続にその操作を許可しているときに限る。権限は呼ばれるたびに DB で確かめるため、
 * admin でなくなったユーザーの接続では、許可していても行えない
 */
async function resolveCatalogOperation(
  ctx: McpToolContext,
  operation: McpCatalogOperation,
): Promise<{ connection: McpConnection } | { error: string }> {
  const resolved = await resolvePermissions(ctx);
  if ("error" in resolved) {
    return resolved;
  }
  const user = await getUserById(resolved.connection.userId, ctx.env.DB);
  if (user?.role !== "admin") {
    return { error: NOT_ADMIN_ERROR };
  }
  if (
    !isCatalogOperationAllowedForMcp(resolved.permissions, user.role, operation)
  ) {
    return { error: operationNotAllowedMessage(operation) };
  }
  return resolved;
}

/**
 * 共通のごはん商品（`catalog_food_products`）の読み取り・追加・編集のツールを登録する。
 * 扱えるのは admin のユーザーで、接続にその操作を許可しているときに限る。
 * 画像は追加・編集で登録・差し替えできる。画像だけの削除と、商品の削除は管理画面だけで行う
 */
export function registerCatalogFoodProductTools(
  server: McpServer,
  ctx: McpToolContext,
) {
  server.registerTool(
    "list_catalog_food_products",
    {
      title: "共通のごはん商品を検索",
      description:
        "共通のごはん商品を検索し、メーカー名・商品名の順に取得する。" +
        `${CATALOG_SEARCH_LIMIT} 件より多く見つかったときは hasMore が true になるため、条件を足して絞り込む。` +
        "商品を追加する前に、同じ商品が登録されていないかを確かめるのに使う。" +
        "CANSHI の管理者のユーザーで、共通のごはん商品の読み取りを許可した接続だけが使える。",
      inputSchema: {
        keyword: z
          .string()
          .optional()
          .describe(
            "商品名・メーカー名・検索キーワードのキーワード。空白で区切ったすべての語を含む商品に絞り込む",
          ),
        manufacturer: z.string().optional().describe("メーカー名（部分一致）"),
        nutritionType: z.enum(["complete", "general"]).optional(),
        textureType: z.enum(["dry", "wet", "soup"]).optional(),
        lifeStage: z
          .enum(FOOD_PRODUCT_LIFE_STAGES)
          .optional()
          .describe("対象の猫。この対象を含む商品に絞り込む"),
        targetBreed: z.string().optional().describe("対象の猫種（完全一致）"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ keyword, ...criteria }) => {
      const resolved = await resolveCatalogOperation(
        ctx,
        "catalogFoodProduct:read",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const { items, hasMore } = await searchCatalogFoodProducts(
        parseCatalogSearchParams({ q: keyword, ...criteria }),
        ctx.env.DB,
      );
      const images = await listMediaAssetsByRecords(
        CATALOG_FOOD_PRODUCT_MEDIA_TYPE,
        items.map((product) => product.id),
        ctx.env.DB,
      );
      return jsonResult({
        catalogFoodProducts: items.map((product) =>
          toCatalogFoodProductSummary(product, images.has(product.id)),
        ),
        hasMore,
      });
    },
  );

  server.registerTool(
    "create_catalog_food_product",
    {
      title: "共通のごはん商品を追加",
      description:
        "共通のごはん商品を 1 件追加し、追加した商品の ID を返す。" +
        "name・kcalPer100g・packageSizes・nutritionType・textureType は必須。" +
        PRODUCT_DESCRIPTION +
        "CANSHI の管理者のユーザーで、共通のごはん商品の追加を許可した接続だけが使える。",
      inputSchema: productFields,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const resolved = await resolveCatalogOperation(
        ctx,
        "catalogFoodProduct:create",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const parsed = parseFormValues(
        catalogFoodProductSchema,
        mergeFormValues({}, formArgs(args)),
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const prepared = prepareImage(args.image);
      if ("error" in prepared) {
        return errorResult(prepared.error);
      }
      const id = await createCatalogFoodProduct(parsed.data, ctx.env.DB);
      const imageError = prepared.image
        ? await saveImage(ctx, id, prepared.image)
        : null;
      return jsonResult(imageError ? { id, imageError } : { id });
    },
  );

  server.registerTool(
    "update_catalog_food_product",
    {
      title: "共通のごはん商品を編集",
      description:
        "共通のごはん商品を 1 件編集する。指定した項目だけを変更し、省略した項目は今の値のまま。" +
        PRODUCT_DESCRIPTION +
        "CANSHI の管理者のユーザーで、共通のごはん商品の編集を許可した接続だけが使える。",
      inputSchema: {
        id: z
          .string()
          .describe(
            "共通のごはん商品の ID（list_catalog_food_products で取得できる）",
          ),
        ...productFields,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      const resolved = await resolveCatalogOperation(
        ctx,
        "catalogFoodProduct:update",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const notFound = `id="${args.id}" の共通のごはん商品が見つかりません`;
      const [product] = await getDb(ctx.env.DB)
        .select()
        .from(catalogFoodProducts)
        .where(eq(catalogFoodProducts.id, args.id))
        .limit(1);
      if (!product) {
        return errorResult(notFound);
      }
      const parsed = parseFormValues(
        catalogFoodProductSchema,
        mergeFormValues(toFormValues(product), formArgs(args)),
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const prepared = prepareImage(args.image);
      if ("error" in prepared) {
        return errorResult(prepared.error);
      }
      if (!(await updateCatalogFoodProduct(args.id, parsed.data, ctx.env.DB))) {
        return errorResult(notFound);
      }
      if (prepared.image) {
        const imageError = await saveImage(ctx, args.id, prepared.image);
        if (imageError) {
          return errorResult(`商品は保存しましたが、${imageError}`);
        }
      }
      return jsonResult({ id: args.id });
    },
  );
}
