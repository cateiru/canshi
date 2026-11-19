import { NavCard } from "@/components/ui";
import { DEV_PAGES } from "./devPages";
import styles from "./page.module.css";

/** 開発用ページ（`/dev/*`）の一覧。本番では表示しない（`src/app/dev/layout.tsx`） */
export default function DevIndexPage() {
  return (
    <main className={styles.main}>
      <h1>開発用ページ</h1>
      <p className={styles.description}>
        開発・確認のためのページです。本番では表示されません。
      </p>
      <ul className={styles.list}>
        {DEV_PAGES.map(({ slug, title, description, icon }) => (
          <li key={slug}>
            <NavCard
              href={`/dev/${slug}`}
              icon={icon}
              title={title}
              titleAs="h2"
              description={description}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
