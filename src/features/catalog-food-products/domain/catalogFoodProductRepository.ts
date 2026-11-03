import type { CatalogFoodProductContent } from "./catalogFoodProduct";

/** 共通のごはん商品の画像。正方形の JPEG */
export type CatalogFoodProductImageFile = {
  bytes: Uint8Array;
  /** 一辺の長さ（px） */
  size: number;
};

/**
 * 共通のごはん商品の保存先。実装は `../infrastructure/catalogFoodProductRepository.ts`
 */
export interface CatalogFoodProductRepository {
  /** 共通のごはん商品を登録し、ID を返す */
  add(content: CatalogFoodProductContent): Promise<string>;
  /** 共通のごはん商品を書き換える。見つからなければ false */
  update(id: string, content: CatalogFoodProductContent): Promise<boolean>;
  /** 商品の今の画像（とサムネイル）の合計の大きさ（バイト） */
  sumImageBytes(id: string): Promise<number>;
  /**
   * 商品の画像を差し替える（画像は 1 商品に 1 枚）。同時に商品が削除されていたら何も残さずに false
   */
  replaceImage(
    id: string,
    image: CatalogFoodProductImageFile,
  ): Promise<boolean>;
}
