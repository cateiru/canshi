import { AnchorLink, type LinkComponentProps } from "../Link/Link";
import styles from "./Footer.module.css";

export type FooterProps = LinkComponentProps & {
  /** 表示するアプリのバージョン（`package.json` の `version`） */
  version: string;
  /** バージョンのリンク先（更新情報のページ） */
  versionHref?: string;
};

export function Footer({
  version,
  versionHref = "/release-notes",
  linkComponent: Link = AnchorLink,
}: FooterProps) {
  return (
    <footer className={styles.footer}>
      <Link href={versionHref} className={`${styles.link} ${styles.version}`}>
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
