import type { Metadata } from "next";
import { Breadcrumb, NavCard } from "@/components/ui";
import { HelpIcon } from "@/components/ui/RecordIcons/RecordIcons";
import { HELP_CATEGORIES, helpHref } from "@/features/help/topics";
import { RecordPageHeading } from "@/features/shared/RecordPageHeading";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "ヘルプ",
};

/** ヘルプの一覧。ログインしていなくても見られる（`src/features/auth/domain/publicPaths.ts`） */
export default function HelpIndexPage() {
  return (
    <main className={styles.main}>
      <Breadcrumb
        items={[{ label: "トップ", href: "/home" }, { label: "ヘルプ" }]}
      />

      <RecordPageHeading icon={HelpIcon}>ヘルプ</RecordPageHeading>
      <p>
        CANSHI
        の使い方をまとめています。はじめて使うときは「はじめに」から順に読むのがおすすめです。
      </p>

      {HELP_CATEGORIES.map((category) => (
        <section
          key={category.id}
          aria-labelledby={`help-category-${category.id}`}
          className={styles.category}
        >
          <h2
            id={`help-category-${category.id}`}
            className={styles.categoryTitle}
          >
            {category.title}
          </h2>
          <ul className={styles.list}>
            {category.topics.map((topic) => (
              <li key={topic.slug}>
                <NavCard
                  href={helpHref(topic.slug)}
                  icon={topic.icon}
                  title={topic.title}
                  titleAs="h3"
                  description={topic.description}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
