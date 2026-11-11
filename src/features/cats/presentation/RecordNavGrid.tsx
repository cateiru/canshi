import { NavCard } from "@/components/ui";
import styles from "./RecordNavGrid.module.css";
import { RECORD_NAV_ITEMS } from "./recordNav";

type RecordNavGridProps = {
  catId: string;
};

/** アイコンの猫は、猫のページのレイアウト（CatCoatIconScope）でその猫の毛色に塗る */
export function RecordNavGrid({ catId }: RecordNavGridProps) {
  return (
    <div className={styles.grid}>
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
  );
}
