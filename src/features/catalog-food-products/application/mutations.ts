import type { CatalogPackageSize } from "@/db/schema";
import { createFoodProductRepository } from "@/features/food-products/infrastructure/foodProductRepository";
import {
  formatBytes,
  hasStorageCapacity,
  resolveMediaLimits,
} from "@/features/media/domain/limits";
import { sumMediaStorageBytes } from "@/features/media/infrastructure/queries";
import {
  type MediaEnv,
  MediaUploadError,
} from "@/features/media/infrastructure/storage";
import { toCatalogFoodProductContent } from "../domain/catalogFoodProduct";
import type { CatalogFoodProductImageFile } from "../domain/catalogFoodProductRepository";
import type { CatalogFoodProductInput } from "../domain/schema";
import { createCatalogFoodProductRepository } from "../infrastructure/catalogFoodProductRepository";

/*
 * 共通のごはん商品の保存（ユースケース）。AI との接続（MCP）から使う（管理画面は `packages/admin` で
 * 別に書く）。admin のユーザーであることは呼び出し元で確かめる。MCP は Next.js（OpenNext）の外で動き
 * `getCloudflareContext()` を使えないため、D1・R2 は引数で受け取る
 */

/** 共通のごはん商品を登録し、ID を返す */
export async function createCatalogFoodProduct(
  values: CatalogFoodProductInput,
  d1?: D1Database,
): Promise<string> {
  return createCatalogFoodProductRepository(d1).add(
    toCatalogFoodProductContent(values),
  );
}

/**
 * 共通のごはん商品を更新する。家に追加済みのごはん商品は内容を写したものなので、変更は
 * 反映されない。商品がなければ false
 */
export async function updateCatalogFoodProduct(
  id: string,
  values: CatalogFoodProductInput,
  d1?: D1Database,
): Promise<boolean> {
  return createCatalogFoodProductRepository(d1).update(
    id,
    toCatalogFoodProductContent(values),
  );
}

/**
 * 共通のごはん商品の画像を差し替える（画像は 1 商品に 1 枚）。
 * 保存容量の上限は、削除するこの商品の今の画像の分を差し引いた、差し替え後の使用容量で確かめ、
 * 超えるときは `MediaUploadError` を投げる。商品がなければ何も保存せずに false
 */
export async function replaceCatalogFoodProductImage(
  productId: string,
  image: CatalogFoodProductImageFile,
  env: MediaEnv,
): Promise<boolean> {
  const repository = createCatalogFoodProductRepository(
    env.DB,
    env.MEDIA_BUCKET,
  );
  const limits = resolveMediaLimits();
  const usedBytes =
    (await sumMediaStorageBytes(env.DB)) -
    (await repository.sumImageBytes(productId));
  if (!hasStorageCapacity(usedBytes, image.bytes.byteLength, limits)) {
    throw new MediaUploadError(
      `保存容量の上限（${formatBytes(limits.storageLimitBytes)}）を超えるためアップロードできません`,
      507,
    );
  }
  return repository.replaceImage(productId, image);
}

/**
 * 共通のごはん商品の内容を写して、家のごはん商品を追加し、その ID を返す。
 * ユーザーが家のメンバーでない、共通のごはん商品か選んだ内容量が見つからない、
 * または同じ家にすでに追加済みのときは追加せずに null（画面の「家に追加」から使う）
 */
export async function addCatalogFoodProductToHousehold(
  userId: string,
  householdId: string,
  catalogFoodProductId: string,
  packageSize: CatalogPackageSize,
  d1?: D1Database,
): Promise<string | null> {
  return createFoodProductRepository(d1).addFromCatalogForMember(
    userId,
    householdId,
    catalogFoodProductId,
    packageSize,
  );
}
