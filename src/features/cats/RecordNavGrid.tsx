import Link from "next/link";
import styles from "./RecordNavGrid.module.css";
import { RECORD_NAV_ITEMS } from "./recordNav";

type RecordNavGridProps = {
  catId: string;
};

export function RecordNavGrid({ catId }: RecordNavGridProps) {
  return (
    <div className={styles.grid}>
      {RECORD_NAV_ITEMS.map((item) => (
        <Link key={item.label} href={item.href(catId)} className={styles.tile}>
          <item.icon className={styles.icon} aria-hidden="true" />
          <span className={styles.label}>{item.label}</span>
        </Link>
      ))}
    </div>
  );
}
