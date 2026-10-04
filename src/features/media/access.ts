import type { MediaAsset } from "@/db/schema";
import { getCatForUser } from "@/features/households/queries";

/**
 * ユーザーがメディアを参照・削除してよいかを判定する。猫に紐付くメディアは
 * その猫の家に所属していることを求める。猫に紐付かないメディア（ごはん商品の画像・
 * 支出の添付・記録に紐付く前の下書き）は、家に関係なくログイン中のユーザーなら許可する
 */
export async function canAccessMediaAsset(
  userId: string,
  asset: Pick<MediaAsset, "catId">,
): Promise<boolean> {
  if (asset.catId == null) {
    return true;
  }
  return (await getCatForUser(userId, asset.catId)) != null;
}
