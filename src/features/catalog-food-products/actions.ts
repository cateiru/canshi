"use server";

import { requireUser } from "@/features/auth/session";
import { FOOD_PRODUCT_MEDIA_TYPE } from "@/features/food-products/media";
import { readFormHouseholdId } from "@/features/households/formHousehold";
import { getHouseholdForUser } from "@/features/households/queries";
import { listMediaAssetsByRecord } from "@/features/media/queries";
import { readMediaObject, storeMediaAsset } from "@/features/media/storage";
import type { SubmitRedirect } from "@/features/navigation/types";
import { CATALOG_FOOD_PRODUCT_MEDIA_TYPE } from "./media";
import { addCatalogFoodProductToHousehold } from "./mutations";
import { parsePackageSizeValue } from "./packageSizes";
import {
  getCatalogFoodProduct,
  listAddedCatalogFoodProductIds,
} from "./queries";
import {
  createCatalogFoodProductRequest,
  MAX_OPEN_CATALOG_REQUESTS,
} from "./requests";
import { parseCatalogSearchParams } from "./search";

/**
 * 追加できたら（追加済みのときも）`redirectTo` に家のごはん商品一覧を返し、クライアント
 * （`useSubmitActionState`）が遷移する。サーバーでリダイレクトすると履歴が積み増され、
 * 一覧から戻ると検索ページに戻ってしまうため、送信後の遷移はほかのフォームと揃える
 */
export type AddCatalogFoodProductState = SubmitRedirect & { error?: string };

/**
 * 共通のごはん商品の画像を、家に追加した商品の画像として保存し直す。家の商品の画像は家ごとに
 * 差し替え・削除できるため、R2 のオブジェクトを共有せず、通常のアップロードと同じ経路
 * （メタデータの除去・サムネイルの作成・保存容量の確認）で別のオブジェクトにする
 */
async function copyCatalogImage(
  catalogFoodProductId: string,
  foodProductId: string,
) {
  const [image] = await listMediaAssetsByRecord(
    CATALOG_FOOD_PRODUCT_MEDIA_TYPE,
    catalogFoodProductId,
  );
  if (!image) {
    return;
  }
  const file = await readMediaObject(image.objectKey);
  if (!file) {
    return;
  }
  await storeMediaAsset({
    recordType: FOOD_PRODUCT_MEDIA_TYPE,
    recordId: foodProductId,
    catId: null,
    file,
  });
}

/**
 * 共通のごはん商品を、フォームの `householdId` の家のごはん商品として追加する。内容を写して
 * 新しい商品を作るため、追加した後は手動で登録した商品と同じく自由に編集できる。
 * 内容量はフォームの `packageSize`（`toPackageSizeValue`）で選んだ候補にする。
 * 同じ家にはすでに追加した商品を重ねて追加しない（別の内容量を選んでも追加しない）。
 * 追加できたら（追加済みのときも）家のごはん商品一覧（`returnToHousehold` があればその家の一覧）を
 * `redirectTo` で返す
 */
export async function addCatalogFoodProductAction(
  catalogFoodProductId: string,
  _prevState: AddCatalogFoodProductState,
  formData: FormData,
): Promise<AddCatalogFoodProductState> {
  const user = await requireUser();
  const householdId = readFormHouseholdId(formData);
  if (!householdId) {
    return { error: "追加先の家を選び直してください" };
  }
  const packageSize = parsePackageSizeValue(formData.get("packageSize"));
  if (!packageSize) {
    return { error: "内容量を選び直してください" };
  }

  const createdId = await addCatalogFoodProductToHousehold(
    user.id,
    householdId,
    catalogFoodProductId,
    packageSize,
  );
  const returnTo = formData.get("returnToHousehold")
    ? `/food-products?householdId=${encodeURIComponent(householdId)}`
    : "/food-products";
  if (!createdId) {
    if (await getHouseholdForUser(user.id, householdId)) {
      // すでに追加済みなら、追加できたときと同じく一覧へ移動する（画像も追加済みのものを使う）
      if (
        (await listAddedCatalogFoodProductIds(householdId)).has(
          catalogFoodProductId,
        )
      ) {
        return { redirectTo: returnTo };
      }
      // 家に所属していて商品もあるなら、選んだ内容量が候補になかった
      if (await getCatalogFoodProduct(catalogFoodProductId)) {
        return {
          error:
            "選んだ内容量は候補から外れました。ページを読み込み直して選び直してください",
        };
      }
    }
    return {
      error:
        "追加できませんでした。商品が削除されたか、選んだ家に所属していない可能性があります",
    };
  }

  try {
    await copyCatalogImage(catalogFoodProductId, createdId);
  } catch (error) {
    // 画像を保存できなくても（保存容量の上限など）、商品は追加したままにする。
    // 画像は追加した後に商品の編集から登録し直せる
    console.error("共通のごはん商品の画像を保存できませんでした", error);
  }

  return { redirectTo: returnTo };
}

export type RequestCatalogFoodProductState = {
  /** リクエストできた（同じ条件のリクエストがすでにあったときも含む） */
  isRequested?: boolean;
  error?: string;
};

/**
 * 検索して見つからなかった共通のごはん商品を、フォームの `searchQuery`（検索ページの URL の
 * クエリ）の検索条件でリクエストする。条件は検索ページと同じ規則で読み直して正規化する
 */
export async function requestCatalogFoodProductAction(
  _prevState: RequestCatalogFoodProductState,
  formData: FormData,
): Promise<RequestCatalogFoodProductState> {
  const user = await requireUser();
  const searchQuery = formData.get("searchQuery");
  const criteria = parseCatalogSearchParams(
    Object.fromEntries(
      new URLSearchParams(typeof searchQuery === "string" ? searchQuery : ""),
    ),
  );
  const result = await createCatalogFoodProductRequest(user.id, criteria);
  switch (result) {
    case "created":
    case "already-requested":
      return { isRequested: true };
    case "no-criteria":
      return { error: "検索条件を入力してから、リクエストしてください" };
    case "limit-reached":
      return {
        error: `対応を待っているリクエストが${MAX_OPEN_CATALOG_REQUESTS}件あります。対応が終わってから、もう一度リクエストしてください`,
      };
  }
}
