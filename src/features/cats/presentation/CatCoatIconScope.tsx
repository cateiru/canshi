import type { ReactNode } from "react";
import type { CatCoatColor } from "@/db/schema";
import styles from "./CatCoatIconScope.module.css";
import { CatCoatPatternDefs, catCoatIconStyle } from "./CatCoatPatternDefs";

type CatCoatIconScopeProps = {
  catId: string;
  coatColor: CatCoatColor | null;
  children: ReactNode;
};

/**
 * 中のイラストアイコン（RecordIcons）の猫を、その猫の毛色で塗る範囲。
 * 猫のページ（`/cats/[catId]` 配下）のレイアウトで包み、詳細の記録の導線・各記録のページの見出し・
 * 一覧などのアイコンをそろえる。レイアウトに影響しないよう、包む要素は display: contents にする
 */
export function CatCoatIconScope({
  catId,
  coatColor,
  children,
}: CatCoatIconScopeProps) {
  const patternId = `cat-coat-${catId}`;

  return (
    <>
      <CatCoatPatternDefs coatColor={coatColor} patternId={patternId} />
      <div
        className={styles.scope}
        style={catCoatIconStyle(coatColor, patternId)}
      >
        {children}
      </div>
    </>
  );
}
