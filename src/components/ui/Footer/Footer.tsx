import Link from "next/link";
import { version } from "../../../../package.json";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <Link
        href="/release-notes"
        className={`${styles.link} ${styles.version}`}
      >
        v{version}
      </Link>
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
