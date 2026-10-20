import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { chunkForBoundParameters } from "@/db/batch";
import { getDb } from "@/db/client";
import {
  FOOD_PRODUCT_LIFE_STAGES,
  type FoodProduct,
  foodProducts,
  householdMembers,
  mediaAssets,
} from "@/db/schema";
import { FOOD_PRODUCT_MEDIA_TYPE } from "@/features/food-products/media";
import {
  createFoodProduct,
  updateFoodProduct,
} from "@/features/food-products/mutations";
import { foodProductFormSchema } from "@/features/food-products/schema";
import { DEFAULT_MEDIA_LIMITS } from "@/features/media/limits";
import { SNIFF_HEAD_BYTES, sniffMediaType } from "@/features/media/mimeSniff";
import {
  deleteMediaAssetRows,
  MediaUploadError,
  storeMediaAsset,
} from "@/features/media/storage";
import { MAX_DECODE_PIXELS } from "@/features/media/thumbnailSize";
import {
  type FormValues,
  mergeFormValues,
  parseFormValues,
  toOptionalValue,
} from "../formValues";
import { isHouseholdAllowedForMcp } from "../permissionRules";
import {
  checkHouseholdOperation,
  errorResult,
  householdNotFoundMessage,
  jsonResult,
  type McpToolContext,
  resolveHouseholdIdsForOperation,
  resolveHouseholdOperation,
  resolvePermissions,
} from "./context";

const PRODUCT_DESCRIPTION =
  "kcalPer100g（100g あたりのカロリー）と packageAmountG（内容量、g）は正の数。" +
  "packageUnit は内容量の単位（「本」「袋」など。1 本 14g なら packageAmountG=14、packageUnit=本）。" +
  "nutritionType は complete=総合栄養食、general=一般食。" +
  "textureType は dry=ドライ、wet=ウェット、soup=スープ。" +
  `lifeStages は対象の猫（${FOOD_PRODUCT_LIFE_STAGES.join("・")}。kitten=子猫、adult=成猫、` +
  "senior=シニア、care=療法食などのケア）で、複数を指定できる。" +
  "targetBreed は対象の猫種（未指定ならすべての猫種向け）。";

/** base64 の文字数の上限。画像の上限（既定 10MB）を base64 にした長さ */
const MAX_IMAGE_BASE64_LENGTH =
  Math.ceil(DEFAULT_MEDIA_LIMITS.maxImageBytes / 3) * 4 + 100;

const IMAGE_DESCRIPTION =
  "商品の画像（JPEG・PNG・WebP・GIF）を base64 で指定する（data URL の形式も可）。" +
  `サムネイルをサーバーで作るため、画素数は ${MAX_DECODE_PIXELS / 1_000_000} 百万画素以下にする` +
  "（長辺 2000px 程度に縮小してから送る）。指定すると今の画像を置き換える。";

const productFields = {
  name: z.string().optional().describe("商品名（100文字以内）"),
  manufacturer: z
    .string()
    .nullable()
    .optional()
    .describe("メーカー名（50文字以内）。null を指定すると空にする"),
  kcalPer100g: z.number().optional().describe("100g あたりのカロリー（kcal）"),
  packageAmountG: z.number().optional().describe("内容量（g）"),
  packageUnit: z
    .string()
    .nullable()
    .optional()
    .describe(
      "内容量の単位（10文字以内）。null を指定すると商品全体の内容量にする",
    ),
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
  image: z
    .string()
    .max(MAX_IMAGE_BASE64_LENGTH)
    .optional()
    .describe(IMAGE_DESCRIPTION),
};

function toFoodProductSummary(product: FoodProduct, hasImage: boolean) {
  return {
    id: product.id,
    householdId: product.householdId,
    name: product.name,
    manufacturer: product.manufacturer,
    kcalPer100g: product.kcalPer100g,
    packageAmountG: product.packageAmountG,
    packageUnit: product.packageUnit,
    nutritionType: product.nutritionType,
    textureType: product.textureType,
    lifeStages: product.lifeStages,
    targetBreed: product.targetBreed,
    hasImage,
  };
}

function toFormValues(product: FoodProduct): FormValues {
  return {
    name: product.name,
    manufacturer: toOptionalValue(product.manufacturer),
    kcalPer100g: product.kcalPer100g,
    packageAmountG: product.packageAmountG,
    packageUnit: toOptionalValue(product.packageUnit),
    nutritionType: product.nutritionType,
    textureType: product.textureType,
    lifeStages: product.lifeStages,
    targetBreed: toOptionalValue(product.targetBreed),
  };
}

/** フォームの値に含めない引数を除く */
function formArgs(args: Record<string, unknown>) {
  const { id: _id, householdId: _householdId, image: _image, ...rest } = args;
  return rest;
}

/** base64（data URL の形式も可）の画像を読む。画像でなければ null */
export function decodeImageBase64(value: string): Blob | null {
  const base64 = value.replace(/^data:[^,]*;base64,/, "").replace(/\s/g, "");
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  if (sniffMediaType(bytes.subarray(0, SNIFF_HEAD_BYTES))?.kind !== "image") {
    return null;
  }
  return new Blob([bytes]);
}

const INVALID_IMAGE_ERROR =
  "image が画像（JPEG・PNG・WebP・GIF）の base64 ではありません";

/**
 * 商品の画像を保存し、それまでの画像を消す（商品の画像は 1 枚）。
 * 失敗したら AI に返すメッセージ
 */
async function replaceFoodProductImage(
  ctx: McpToolContext,
  productId: string,
  image: Blob,
): Promise<string | null> {
  let asset: { id: string };
  try {
    asset = await storeMediaAsset(
      {
        file: image,
        recordType: FOOD_PRODUCT_MEDIA_TYPE,
        recordId: productId,
        catId: null,
      },
      ctx.env,
    );
  } catch (error) {
    if (error instanceof MediaUploadError) {
      return `画像を保存できませんでした。${error.message}`;
    }
    throw error;
  }
  const previous = await getDb(ctx.env.DB)
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.recordType, FOOD_PRODUCT_MEDIA_TYPE),
        eq(mediaAssets.recordId, productId),
        ne(mediaAssets.id, asset.id),
      ),
    );
  await deleteMediaAssetRows(previous, ctx.env);
  return null;
}

/**
 * ごはん商品の読み取り・追加・編集のツールを登録する。扱えるのは、読み取りを許可している家で、
 * その操作を許可している家の商品に限る
 */
export function registerFoodProductTools(
  server: McpServer,
  ctx: McpToolContext,
) {
  server.registerTool(
    "list_food_products",
    {
      title: "ごはん商品の一覧を取得",
      description:
        "家に登録されているごはん商品の一覧を新しい順に取得する。" +
        "ごはんの記録・プリセットの foodProductId に使う。householdId を指定するとその家の商品に絞り込む。" +
        "ユーザーがごはん商品の読み取りを許可している家の商品だけを含む。",
      inputSchema: {
        householdId: z
          .string()
          .optional()
          .describe("家の ID（list_households で取得できる）"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ householdId }) => {
      const resolved = await resolveHouseholdIdsForOperation(
        ctx,
        "foodProduct:read",
        householdId,
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const { householdIds } = resolved;
      const db = getDb(ctx.env.DB);
      const products = await db
        .select()
        .from(foodProducts)
        .where(inArray(foodProducts.householdId, householdIds))
        .orderBy(desc(foodProducts.createdAt));
      const withImage = new Set<string>();
      // recordType の分を 1 個予約し、ID は D1 のバインド上限に収まるよう分割する
      for (const ids of chunkForBoundParameters(
        products.map((product) => product.id),
        1,
      )) {
        const images = await db
          .selectDistinct({ recordId: mediaAssets.recordId })
          .from(mediaAssets)
          .where(
            and(
              eq(mediaAssets.recordType, FOOD_PRODUCT_MEDIA_TYPE),
              inArray(mediaAssets.recordId, ids),
            ),
          );
        for (const image of images) {
          withImage.add(image.recordId);
        }
      }
      return jsonResult({
        foodProducts: products.map((product) =>
          toFoodProductSummary(product, withImage.has(product.id)),
        ),
      });
    },
  );

  server.registerTool(
    "create_food_product",
    {
      title: "ごはん商品を追加",
      description:
        "家にごはん商品を 1 件追加し、追加した商品の ID を返す。" +
        "name・kcalPer100g・packageAmountG・nutritionType・textureType は必須。" +
        PRODUCT_DESCRIPTION +
        "画像を保存できなかったときも商品は追加し、imageError に理由を返す。",
      inputSchema: {
        householdId: z
          .string()
          .describe("商品を追加する家の ID（list_households で取得できる）"),
        ...productFields,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (args) => {
      const resolved = await resolveHouseholdOperation(
        ctx,
        args.householdId,
        "foodProduct:create",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const parsed = parseFormValues(
        foodProductFormSchema,
        mergeFormValues({}, formArgs(args)),
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const image =
        args.image === undefined ? undefined : decodeImageBase64(args.image);
      if (image === null) {
        return errorResult(INVALID_IMAGE_ERROR);
      }
      // ユーザーが家のメンバーでなければ追加しない（`createFoodProduct` 参照）
      const id = await createFoodProduct(
        resolved.connection.userId,
        args.householdId,
        parsed.data,
        ctx.env.DB,
      );
      if (!id) {
        return errorResult(householdNotFoundMessage(args.householdId));
      }
      const imageError = image
        ? await replaceFoodProductImage(ctx, id, image)
        : null;
      return jsonResult(imageError ? { id, imageError } : { id });
    },
  );

  server.registerTool(
    "update_food_product",
    {
      title: "ごはん商品を編集",
      description:
        "ごはん商品を 1 件編集する。指定した項目だけを変更し、省略した項目は今の値のまま。" +
        PRODUCT_DESCRIPTION,
      inputSchema: {
        id: z.string().describe("商品の ID（list_food_products で取得できる）"),
        ...productFields,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      const resolved = await resolvePermissions(ctx);
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const notFound = `id="${args.id}" のごはん商品が見つかりません`;
      const [row] = await getDb(ctx.env.DB)
        .select({ foodProduct: foodProducts })
        .from(foodProducts)
        .innerJoin(
          householdMembers,
          eq(foodProducts.householdId, householdMembers.householdId),
        )
        .where(
          and(
            eq(foodProducts.id, args.id),
            eq(householdMembers.userId, resolved.connection.userId),
          ),
        )
        .limit(1);
      const product = row?.foodProduct;
      if (
        !product?.householdId ||
        !isHouseholdAllowedForMcp(resolved.permissions, product.householdId)
      ) {
        return errorResult(notFound);
      }
      const operationError = await checkHouseholdOperation(
        ctx,
        resolved,
        product.householdId,
        "foodProduct:update",
      );
      if (operationError) {
        return errorResult(operationError);
      }
      const parsed = parseFormValues(
        foodProductFormSchema,
        mergeFormValues(toFormValues(product), formArgs(args)),
      );
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const image =
        args.image === undefined ? undefined : decodeImageBase64(args.image);
      if (image === null) {
        return errorResult(INVALID_IMAGE_ERROR);
      }
      if (
        !(await updateFoodProduct(
          resolved.connection.userId,
          args.id,
          parsed.data,
          ctx.env.DB,
        ))
      ) {
        return errorResult(notFound);
      }
      if (image) {
        const imageError = await replaceFoodProductImage(ctx, args.id, image);
        if (imageError) {
          return errorResult(`商品は保存しましたが、${imageError}`);
        }
      }
      return jsonResult({ id: args.id });
    },
  );
}
