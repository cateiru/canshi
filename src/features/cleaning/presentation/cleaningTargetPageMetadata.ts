import type { Metadata } from "next";
import { getAccessibleCat } from "@/features/auth/presentation/session";
import { getCleaningTargetById } from "../infrastructure/targetQueries";

type CleaningTargetPageMetadataProps = {
  params: Promise<{ catId: string; targetId: string }>;
};

/**
 * 掃除対象ごとのページの `generateMetadata` を作る。title は見出しと同じく掃除対象の名前を含める。
 * 参照できない猫・別の猫の掃除対象なら title を付けない（ページ本体が 404 にする）
 */
export function cleaningTargetPageMetadata(
  toTitle: (targetName: string) => string,
) {
  return async ({
    params,
  }: CleaningTargetPageMetadataProps): Promise<Metadata> => {
    const { catId, targetId } = await params;
    const [cat, cleaningTarget] = await Promise.all([
      getAccessibleCat(catId),
      getCleaningTargetById(targetId),
    ]);
    if (!cat || !cleaningTarget || cleaningTarget.catId !== catId) {
      return {};
    }
    return { title: toTitle(cleaningTarget.name) };
  };
}
