import Link from "next/link";
import { version } from "../../../../package.json";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.row}>
        <Link href="/release-notes" className={styles.link}>
          更新情報
        </Link>
        <span className={styles.version}>v{version}</span>
      </div>
      <p className={styles.copyright}>
        © 2026{" "}
        <a
          href="https://cateiru.com"
          target="_blank"
          rel="noreferrer"
          className={styles.link}
        >
          cateiru
        </a>
      </p>
    </footer>
  );
}
