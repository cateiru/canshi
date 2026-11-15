import type { Metadata } from "next";
import { getAccessibleCat } from "@/features/auth/presentation/session";

type CatPageMetadataProps = {
  params: Promise<{ catId: string }>;
};

/**
 * `/cats/[catId]` 配下のページの `generateMetadata` を作る。title は見出しと同じく猫の名前を含め、
 * ルートレイアウトのテンプレートで「… | CANSHI」になる。猫はページ本体と同じ
 * `getAccessibleCat` で取るため、1 回のリクエストの中では DB を引き直さない。
 * 参照できない猫なら title を付けない（ページ本体が 404 にする）
 */
export function catPageMetadata(toTitle: (catName: string) => string) {
  return async ({ params }: CatPageMetadataProps): Promise<Metadata> => {
    const { catId } = await params;
    const cat = await getAccessibleCat(catId);
    return cat ? { title: toTitle(cat.name) } : {};
  };
}
