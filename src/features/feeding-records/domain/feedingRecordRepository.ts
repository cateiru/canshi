import type { RecordActor } from "@/db/schema";
import type {
  FeedingRecordContent,
  FeedingRecordFoodProduct,
} from "./feedingRecord";

/**
 * ごはん記録の保存先。実装は `../infrastructure/feedingRecordRepository.ts`。
 *
 * 明細の商品は保存前に猫の家の商品か確かめている。猫を飼う家は登録後は変えられないが、
 * 確認と保存の間に猫の家が変わっても別の家の商品が記録に入らないよう、念のため追加・更新は猫が
 * 確認した時点の家（`householdId`）にいるときだけ行う
 */
export interface FeedingRecordRepository {
  /** 指定した商品を読む（家では絞らない） */
  findFoodProducts(ids: string[]): Promise<FeedingRecordFoodProduct[]>;
  /** 猫の記録の日時を読む。見つからなければ null */
  findOccurredAtForCat(catId: string, id: string): Promise<Date | null>;
  /** 記録の明細が使っている商品の ID */
  listItemFoodProductIds(id: string): Promise<string[]>;
  /**
   * 記録を明細ごと追加し、その ID を返す。猫が `householdId` の家にいなければ null。
   * `completeNotifications` なら、家の未対応のごはんの時間の通知を同じ batch で完了にする
   */
  addWhileCatInHousehold(
    catId: string,
    householdId: string,
    content: FeedingRecordContent,
    completeNotifications: boolean,
    actor: RecordActor,
  ): Promise<string | null>;
  /** 記録を書き換え、明細を入れ直す。猫が `householdId` の家にいなければ false */
  updateWhileCatInHousehold(
    catId: string,
    householdId: string,
    id: string,
    content: FeedingRecordContent,
    completeNotifications: boolean,
    actor: RecordActor,
  ): Promise<boolean>;
  /** 猫の記録を論理削除する（明細は残す）。見つからない・削除済みなら false */
  remove(catId: string, id: string, actor: RecordActor): Promise<boolean>;
}
