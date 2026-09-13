import Link from "next/link";
import { version } from "../../../../package.json";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <Link href="/release-notes" className={styles.link}>
        更新情報
      </Link>
      <span className={styles.version}>v{version}</span>
    </footer>
  );
}
