import { NavCard } from "@/components/ui";
import type { CatCoatColor } from "@/db/schema";
import { CatCoatPatternDefs, catCoatIconStyle } from "./CatCoatPatternDefs";
import styles from "./RecordNavGrid.module.css";
import { RECORD_NAV_ITEMS } from "./recordNav";

type RecordNavGridProps = {
  catId: string;
  /** 導線のアイコンの猫を、この毛色のベース色で塗る */
  coatColor: CatCoatColor | null;
};

export function RecordNavGrid({ catId, coatColor }: RecordNavGridProps) {
  const patternId = `cat-coat-${catId}`;

  return (
    <>
      <CatCoatPatternDefs coatColor={coatColor} patternId={patternId} />
      <div
        className={styles.grid}
        style={catCoatIconStyle(coatColor, patternId)}
      >
        {RECORD_NAV_ITEMS.map((item) => (
          <NavCard
            key={item.label}
            href={item.href(catId)}
            layout="tile"
            icon={item.icon}
            title={item.label}
          />
        ))}
      </div>
    </>
  );
}
